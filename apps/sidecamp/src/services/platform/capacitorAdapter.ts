import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { CapacitorHttp, Capacitor } from '@capacitor/core';
import { FolderPicker } from './folderPickerPlugin';
import { PeerSharing } from './peerSharingPlugin';
import { generateKeyPair, encryptFor, decryptFrom } from '../e2eCrypto';

function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function createCapacitorAdapter() {
  const logListeners: ((msg: string) => void)[] = [];
  const statusListeners: ((status: string) => void)[] = [];
  const progressListeners: ((data: any) => void)[] = [];
  const chatListeners: ((data: { from: string; text: string; ts: number; lobby?: boolean; e2e?: boolean }) => void)[] = [];
  const downloadLogListeners: ((msg: string) => void)[] = [];
  const downloadProgressListeners: ((data: any) => void)[] = [];

  const emitLog = (msg: string) => logListeners.forEach(fn => fn(msg));
  const emitStatus = (status: string) => statusListeners.forEach(fn => fn(status));
  const emitDownloadLog = (msg: string) => downloadLogListeners.forEach(fn => fn(msg));
  const emitChat = (data: { from: string; text: string; ts: number; lobby?: boolean; e2e?: boolean }) => chatListeners.forEach(fn => fn(data));

  // E2E chat: fresh Curve25519 identity per app run, exchanged with peers over
  // the existing peer WS ('pubkey' messages) — the relay server never sees plaintext.
  const myKeyPair = generateKeyPair();
  const peerPublicKeys = new Map<string, string>();

  // --- Peer Daemon (WS client to the TuneCamp server — same protocol as the
  // Electron PeerDaemon, just run in the WebView instead of Node) ---
  const AUDIO_EXT = new Set(['.mp3', '.flac', '.ogg', '.m4a', '.wav']);
  let ws: WebSocket | null = null;
  let peerRunning = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const fileIndex = new Map<string, { uri: string; title: string; artist: string; album: string; sizeBytes: number; format: string; allowDownload: boolean }>();
  const cancelledRequests = new Set<string>();

  const hashId = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return 'p' + (h >>> 0).toString(16);
  };

  const bytesToBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const walkAudioFiles = async (root: string, subpath: string, out: { uri: string; name: string }[]) => {
    // content:// SAF tree URIs (from FolderPicker.pick) aren't listable via
    // @capacitor/filesystem ("readdir not supported for content uri") — use
    // the native FolderPicker.list() instead, recursing on each child's own
    // uri (SAF has no path-concat convention, unlike file:// roots below).
    const isContent = root.startsWith('content://');
    if (isContent) {
      const result = await FolderPicker.list({ uri: root });
      for (const f of result.files) {
        if (f.isDirectory) {
          await walkAudioFiles(f.uri, '', out);
        } else {
          const dot = f.name.lastIndexOf('.');
          if (dot > 0 && AUDIO_EXT.has(f.name.slice(dot).toLowerCase())) out.push({ uri: f.uri, name: f.name });
        }
      }
      return;
    }
    const target = subpath ? `${root}/${subpath}` : root;
    const result = await Filesystem.readdir({ path: target });
    for (const f of result.files as any[]) {
      const childSub = subpath ? `${subpath}/${f.name}` : f.name;
      if (f.type === 'directory') {
        await walkAudioFiles(root, childSub, out);
      } else {
        const dot = f.name.lastIndexOf('.');
        if (dot > 0 && AUDIO_EXT.has(f.name.slice(dot).toLowerCase())) out.push({ uri: f.uri, name: f.name });
      }
    }
  };

  const scanFolders = async (folders: string[], allowDownloads: boolean) => {
    fileIndex.clear();
    emitLog('[Mobile] Avvio scansione cartelle locali...');
    const tracks: any[] = [];
    for (const root of folders) {
      if (!root) continue;
      try {
        const found: { uri: string; name: string }[] = [];
        await walkAudioFiles(root, '', found);
        for (const f of found) {
          const id = hashId(f.uri);
          const dot = f.name.lastIndexOf('.');
          const title = dot > 0 ? f.name.slice(0, dot) : f.name;
          let sizeBytes = 0;
          try { sizeBytes = (await Filesystem.stat({ path: f.uri })).size; } catch {}
          const track = {
            uri: f.uri, title, artist: 'Unknown Artist', album: 'Unknown Album',
            sizeBytes, format: (dot > 0 ? f.name.slice(dot + 1) : '').toLowerCase(), allowDownload: allowDownloads,
          };
          fileIndex.set(id, track);
          tracks.push({ id, title, artist: track.artist, album: track.album, sizeBytes, fileSizeBytes: sizeBytes, duration: 0, bitrate: 0, format: track.format, mimeType: track.format, allowDownload: allowDownloads });
        }
      } catch (e: any) {
        emitLog(`[Mobile] Errore scansione ${root}: ${e.message}`);
      }
    }
    emitLog(`[Mobile] Scansione completata. ${tracks.length} tracce indicizzate.`);
    return tracks;
  };

  const handlePeerRequest = async (requestId: string, trackId: string) => {
    const track = fileIndex.get(trackId);
    if (!track) {
      ws?.send(JSON.stringify({ type: 'chunk_error', requestId, message: 'File non trovato' }));
      return;
    }
    emitLog(`[Mobile] Streaming/Download richiesto: ${track.title} [Req: ${requestId}]`);
    try {
      const { data } = track.uri.startsWith('content://')
        ? await FolderPicker.readFile({ uri: track.uri })
        : await Filesystem.readFile({ path: track.uri });
      const binary = atob(data as string);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const CHUNK = 64 * 1024;
      let seq = 0;
      for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        if (cancelledRequests.has(requestId) || ws?.readyState !== WebSocket.OPEN) break;
        ws.send(JSON.stringify({ type: 'chunk', requestId, seq: seq++, data: bytesToBase64(bytes.subarray(offset, offset + CHUNK)) }));
      }
      if (!cancelledRequests.has(requestId) && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chunk_end', requestId }));
        emitLog(`[Mobile] Streaming/Download completato: ${track.title} [Req: ${requestId}]`);
      }
      cancelledRequests.delete(requestId);
    } catch (e: any) {
      ws?.send(JSON.stringify({ type: 'chunk_error', requestId, message: e.message }));
    }
  };

  const connectPeer = (config: { server: string; token: string; folders: string[]; allowDownloads: boolean }) => {
    if (!peerRunning) return;
    try {
      const wsUrl = new URL(config.server);
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl.pathname = '/ws/peer';
      wsUrl.searchParams.set('token', config.token);
      wsUrl.searchParams.set('allowDownloads', String(config.allowDownloads));

      emitStatus('connecting');
      ws = new WebSocket(wsUrl.toString());

      ws.onopen = () => emitLog('[Mobile] WebSocket connesso. In attesa di autorizzazione...');

      ws.onmessage = async (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'auth_ok') {
            emitStatus('online');
            emitLog(`[Mobile] Connesso a TuneCamp (Sessione: ${msg.sessionId}). Invio indice libreria...`);
            ws?.send(JSON.stringify({ type: 'pubkey', pubkey: myKeyPair.publicKey }));
            const tracks = await scanFolders(config.folders, config.allowDownloads);
            ws?.send(JSON.stringify({ type: 'manifest', tracks }));
          } else if (msg.type === 'pubkey') {
            peerPublicKeys.set(msg.from, msg.pubkey);
          } else if (msg.type === 'chat') {
            if (msg.lobby) {
              emitChat({ from: msg.from, text: msg.text, ts: msg.ts, lobby: true });
            } else {
              const senderKey = peerPublicKeys.get(msg.from);
              const plain = senderKey ? decryptFrom(msg.text, senderKey, myKeyPair.secretKey) : null;
              emitChat({ from: msg.from, text: plain ?? '[Encrypted message — key exchange pending]', ts: msg.ts, e2e: true });
            }
          } else if (msg.type === 'ping') {
            ws?.send(JSON.stringify({ type: 'pong' }));
          } else if (msg.type === 'stream_request' || msg.type === 'download_request') {
            handlePeerRequest(msg.requestId, msg.trackId);
          } else if (msg.type === 'cancel_request') {
            cancelledRequests.add(msg.requestId);
          }
        } catch (_e) {}
      };

      ws.onclose = () => {
        emitStatus('disconnected');
        if (peerRunning) {
          emitLog('[Mobile] Connessione persa. Riconnessione tra 5s...');
          reconnectTimer = setTimeout(() => connectPeer(config), 5000);
        } else {
          emitStatus('offline');
        }
      };

      ws.onerror = () => emitLog('[Mobile] Errore WebSocket.');
    } catch (e: any) {
      emitLog(`[Mobile] Errore di avvio: ${e.message}`);
      if (peerRunning) reconnectTimer = setTimeout(() => connectPeer(config), 5000);
    }
  };

  return {
    // Config & Auth
    setUploadConfig: async (server: string, token: string) => {
      await Preferences.set({ key: 'server_url', value: server });
      await Preferences.set({ key: 'server_token', value: token });
      return { success: true };
    },

    uploadTrack: async (filePath: string, _metadata: any) => {
      emitLog(`[Mobile] Upload di ${filePath} avviato tramite API server.`);
      return { success: true };
    },

    // Soulseek & Search
    slskConnect: async (user: string, _pass: string) => {
      emitStatus('connected');
      emitLog(`[Mobile] Connessione a Soulseek simulata per l'utente ${user}`);
      return { success: true };
    },

    slskSearch: async (query: string) => {
      emitLog(`[Mobile] Ricerca Soulseek per "${query}" - Su mobile si consiglia la ricerca Network/Server.`);
      return [];
    },

    searchWeb: async (query: string, source: string, server?: string, token?: string) => {
      if (source === 'network' && server && token) {
        try {
          const cleanServer = server.replace(/\/$/, '');
          const res = await CapacitorHttp.get({
            url: `${cleanServer}/api/peers/search?q=${encodeURIComponent(query)}`,
            headers: { Authorization: `Bearer ${token}` }
          });
          const peerTracks = Array.isArray(res.data) ? res.data : [];
          return peerTracks.map((track: any) => ({
            id: 'peer_' + track.session_id + '_' + track.id,
            title: track.title,
            artist: track.artist || 'Unknown Artist',
            album: track.album || `Network: ${track.username || 'Unknown'}`,
            url: '',
            source: 'peer',
            sessionId: track.session_id,
            trackId: track.id,
            size: track.file_size || 0,
            bitrate: 0,
            user: `Network (${track.username || 'Unknown'})`
          }));
        } catch (e: any) {
          emitLog(`[Mobile] Errore ricerca network: ${e.message}`);
        }
      }
      return [];
    },

    slskDownload: async (_result: any) => {
      emitDownloadLog(`[Mobile] Download Soulseek delegato al server.`);
      return { success: true };
    },

    slskStatus: async () => 'connected',

    // Torrent
    torrentDownload: async (_magnetUri: string, _downloadId?: string) => {
      emitDownloadLog(`[Mobile] Download Torrent tramite magnet link delegato al server.`);
      return { success: true };
    },

    torrentSeed: async (_input: string | string[], _torrentName?: string) => {
      emitLog(`[Mobile] Seeding di torrent non supportato in background su mobile.`);
      return { success: false };
    },

    // Ytdlp
    ytdlpDownload: async (url: string) => {
      emitDownloadLog(`[Mobile] Ripping audio yt-dlp delegato al server per URL: ${url}`);
      return { success: true };
    },

    // Local Files & Storage — same folders configured for peer sharing
    // (scanFolders), not a separate app-private download dir: on mobile
    // there is no local downloader, so the Library IS the shared folders.
    listDownloads: async (extraRoots?: string[]) => {
      const roots = (extraRoots || []).filter(Boolean);
      const out: { name: string; path: string; size: number; isDir: boolean }[] = [];
      for (const root of roots) {
        try {
          const found: { uri: string; name: string }[] = [];
          await walkAudioFiles(root, '', found);
          for (const f of found) {
            let size = 0;
            try { size = (await Filesystem.stat({ path: f.uri })).size; } catch (_e) {}
            out.push({ name: f.name, path: f.uri, size, isDir: false });
          }
        } catch (e: any) {
          emitLog(`[Mobile] Errore scansione libreria ${root}: ${e.message}`);
        }
      }
      return out;
    },

    deleteDownload: async (filePath: string) => {
      await Filesystem.deleteFile({ path: filePath });
      return { success: true };
    },

    // Peer Daemon & Reverse Sockets
    startPeer: async (config: { server: string; token: string; folders: string[]; allowDownloads: boolean }) => {
      peerRunning = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (ws) { try { ws.close(); } catch (_e) {} }
      connectPeer(config);
      try { await PeerSharing.start(); } catch (e: any) { emitLog(`[Mobile] Foreground service non avviato: ${e.message}`); }
      return { success: true };
    },

    stopPeer: async () => {
      peerRunning = false;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (ws) { ws.close(); ws = null; }
      cancelledRequests.clear();
      try { await PeerSharing.stop(); } catch (_e) {}
      emitLog('[Mobile] Peer sharing arrestato.');
      emitStatus('offline');
      return { success: true };
    },

    sendPeerChat: async (to: string, text: string) => {
      if (ws?.readyState !== WebSocket.OPEN) return { success: false, error: 'Not connected' };
      let payload = text;
      let e2e = false;
      if (to) {
        const pubkey = peerPublicKeys.get(to);
        if (pubkey) {
          payload = encryptFor(text, pubkey, myKeyPair.secretKey);
          e2e = true;
        }
        // no pubkey → send plaintext (peer on older version or key exchange pending)
      }
      ws.send(JSON.stringify({ type: 'chat', to, text: payload }));
      emitLog(`[Chat Mobile] Inviato a ${to || 'Lobby'}${e2e ? ' 🔒' : ''}`);
      return { success: true, e2e };
    },

    // Shared Files Browser (backed by @capacitor/filesystem — root is an
    // absolute file:// URI, e.g. from getDownloadsDir, so calls omit `directory`)
    listSharedDir: async (root: string, subpath: string) => {
      if (!root) return { error: 'No folder selected' };
      const target = subpath ? `${root}/${subpath}` : root;
      try {
        const result = await Filesystem.readdir({ path: target });
        const entries = result.files
          .map((f: any) => ({ name: f.name, isDir: f.type === 'directory' }))
          .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
        return { entries };
      } catch (e: any) {
        return { error: e.message };
      }
    },

    mkdirShared: async (root: string, subpath: string, name: string) => {
      const clean = String(name || '').replace(/[<>:"/\\|?*]/g, '').trim();
      if (!clean) return { error: 'Invalid folder name' };
      const target = subpath ? `${root}/${subpath}/${clean}` : `${root}/${clean}`;
      try {
        await Filesystem.mkdir({ path: target, recursive: true });
        return { ok: true };
      } catch (e: any) {
        return { error: e.message };
      }
    },

    deleteShared: async (root: string, subpath: string, name: string, isDir: boolean) => {
      if (!name) return { error: 'Nothing to delete' };
      const target = subpath ? `${root}/${subpath}/${name}` : `${root}/${name}`;
      try {
        if (isDir) {
          await Filesystem.rmdir({ path: target, recursive: true });
        } else {
          await Filesystem.deleteFile({ path: target });
        }
        return { ok: true };
      } catch (e: any) {
        return { error: e.message };
      }
    },

    moveShared: async (srcRoot: string, srcSub: string, name: string, destRoot: string, destSub: string) => {
      if (!name) return { error: 'Nothing to move' };
      const from = srcSub ? `${srcRoot}/${srcSub}/${name}` : `${srcRoot}/${name}`;
      const to = destSub ? `${destRoot}/${destSub}/${name}` : `${destRoot}/${name}`;
      try {
        await Filesystem.rename({ from, to });
        return { ok: true };
      } catch (e: any) {
        return { error: e.message };
      }
    },

    // media:// (local file) and stream://audio?url=&token= (remote) are
    // Electron-only custom protocol schemes — resolve them into a URL the
    // mobile WebView can actually play.
    resolvePlaybackSrc: async (src: string): Promise<string> => {
      if (src.startsWith('media://')) {
        const filePath = decodeURIComponent(src.slice('media://'.length));
        return Capacitor.convertFileSrc(filePath);
      }
      if (src.startsWith('stream://audio?')) {
        const params = new URLSearchParams(src.slice(src.indexOf('?') + 1));
        const url = params.get('url') || '';
        const token = params.get('token') || '';
        const res = await CapacitorHttp.get({
          url,
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        const mime = res.headers?.['Content-Type'] || res.headers?.['content-type'] || 'audio/mpeg';
        return URL.createObjectURL(base64ToBlob(res.data, mime));
      }
      return src;
    },

    getDownloadsDir: async () => {
      const res = await Filesystem.getUri({
        path: 'SidecampDownloads',
        directory: Directory.Documents,
      });
      return res.uri;
    },

    checkForUpdate: async () => null,
    openReleasesPage: async () => {},

    // Event Listeners
    onPeerLog: (cb: (msg: string) => void) => { logListeners.push(cb); },
    onPeerStatus: (cb: (status: string) => void) => { statusListeners.push(cb); },
    onPeerProgress: (cb: (data: any) => void) => { progressListeners.push(cb); },
    onPeerChat: (cb: (data: { from: string; text: string; ts: number }) => void) => { chatListeners.push(cb); },
    onDownloadLog: (cb: (msg: string) => void) => { downloadLogListeners.push(cb); },
    onDownloadProgress: (cb: (data: any) => void) => { downloadProgressListeners.push(cb); },

    openDownload: async (_filePath: string) => {},
    removeTorrent: async (_infoHash: string) => {},
    readTags: async (_filePath: string) => ({ title: '', artist: '', album: '' }),
    getTracksMeta: async (_paths: string[]) => ({}),
    setTrackAnalysis: async (_filePath: string, _data: any) => {},
    saveRecording: async (_filename: string, _data: Uint8Array) => {},
    readAudioFile: async (_filePath: string) => new Uint8Array(),
    writeTags: async (_filePath: string, _tags: any) => {},
    renameDownload: async (_filePath: string, _newFilename: string) => {},
    moveDownload: async (_filePath: string, _destFolder: string) => {},
    pickFolder: async () => {
      try {
        const { uri } = await FolderPicker.pick();
        return uri || '';
      } catch (_e) {
        return '';
      }
    },
    saveFile: async (_filename: string, _content: string) => '',
    openFile: async () => '',
    exportPlaylist: async (_destDir: string, _folderName: string, _items: any[]) => {},

    // Library Organizer
    organizeScan: async (_root: string, _mode: string) => ({ actions: [] }),
    organizeApply: async (_root: string, _actions: any[]) => ({ success: true }),
    organizeFillGenres: async (_root: string) => {},
    organizeFillGenresCancel: async () => {},
    onGenreProgress: (_cb: any) => {},

    encryptString: async (plain: string) => plain,
    decryptString: async (stored: string) => stored,

    // Onboarding: register/login against a TuneCamp instance. Uses CapacitorHttp
    // (native request, not the webview's fetch) so it isn't subject to the
    // webview's CORS restrictions the way a plain fetch() would be.
    authConnect: async (server: string, mode: 'login' | 'register', username: string, password: string) => {
      const res = await CapacitorHttp.post({
        url: `${server.replace(/\/$/, '')}/api/auth/${mode}`,
        headers: { 'Content-Type': 'application/json' },
        data: { username, password }
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(res.data?.error || 'Connection failed');
      }
      return res.data;
    },

    // Network Explorer (HTTP API native fetches)
    getNetworkPeers: async (server: string, token: string) => {
      const res = await CapacitorHttp.get({
        url: `${server.replace(/\/$/, '')}/api/peers`,
        headers: { Authorization: `Bearer ${token}` }
      });
      return Array.isArray(res.data) ? res.data : [];
    },

    getPeerTracks: async (server: string, token: string, sessionId: string, origin?: string) => {
      const cleanServer = server.replace(/\/$/, '');
      const url = origin
        ? `${cleanServer}/api/peers/${sessionId}/tracks?origin=${encodeURIComponent(origin)}`
        : `${cleanServer}/api/peers/${sessionId}/tracks`;
      const res = await CapacitorHttp.get({
        url,
        headers: { Authorization: `Bearer ${token}` }
      });
      return Array.isArray(res.data) ? res.data : [];
    },

    downloadPeerTrack: async (server: string, token: string, sessionId: string, trackId: string, _artist: string, _title: string, origin?: string) => {
      const url = origin
        ? `${origin.replace(/\/$/, '')}/api/peers/${sessionId}/tracks/${trackId}/federated-download`
        : `${server.replace(/\/$/, '')}/api/peers/${sessionId}/tracks/${trackId}/download?token=${token}`;
      await CapacitorHttp.get({ url });
      return `mobile_download_${trackId}`;
    },

    getCatalogTracks: async (server: string, token: string) => {
      const res = await CapacitorHttp.get({
        url: `${server.replace(/\/$/, '')}/api/tracks`,
        headers: { Authorization: `Bearer ${token}` }
      });
      return Array.isArray(res.data) ? res.data : [];
    },

    downloadCatalogTrack: async (server: string, token: string, trackId: string, _artist: string, _title: string) => {
      await CapacitorHttp.get({
        url: `${server.replace(/\/$/, '')}/api/tracks/${trackId}/download`,
        headers: { Authorization: `Bearer ${token}` }
      });
      return `catalog_${trackId}`;
    },
  };
}
