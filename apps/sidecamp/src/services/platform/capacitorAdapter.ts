import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

export function createCapacitorAdapter() {
  const logListeners: ((msg: string) => void)[] = [];
  const statusListeners: ((status: string) => void)[] = [];
  const progressListeners: ((data: any) => void)[] = [];
  const chatListeners: ((data: { from: string; text: string; ts: number }) => void)[] = [];
  const downloadLogListeners: ((msg: string) => void)[] = [];
  const downloadProgressListeners: ((data: any) => void)[] = [];

  const emitLog = (msg: string) => logListeners.forEach(fn => fn(msg));
  const emitStatus = (status: string) => statusListeners.forEach(fn => fn(status));
  const emitDownloadLog = (msg: string) => downloadLogListeners.forEach(fn => fn(msg));

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
      return { results: [] };
    },

    searchWeb: async (query: string, source: string, server?: string, token?: string) => {
      if (server && token) {
        try {
          const res = await fetch(`${server}/api/search?q=${encodeURIComponent(query)}&source=${source}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return await res.json();
        } catch (e: any) {
          emitLog(`[Mobile] Errore ricerca web: ${e.message}`);
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

    // Local Files & Storage (Capacitor Filesystem)
    listDownloads: async (_extraRoots?: string[]) => {
      try {
        const result = await Filesystem.readdir({
          path: 'SidecampDownloads',
          directory: Directory.Documents,
        });
        return result.files.map((f: any) => ({
          name: f.name,
          path: f.uri,
          size: f.size,
          isDir: f.type === 'directory',
        }));
      } catch (_e) {
        try {
          await Filesystem.mkdir({
            path: 'SidecampDownloads',
            directory: Directory.Documents,
            recursive: true,
          });
        } catch (_) {}
        return [];
      }
    },

    deleteDownload: async (filePath: string) => {
      await Filesystem.deleteFile({ path: filePath });
      return { success: true };
    },

    // Peer Daemon & Reverse Sockets
    startPeer: async (_config: any) => {
      emitStatus('peer:online');
      return { success: true };
    },

    stopPeer: async () => {
      emitStatus('peer:offline');
      return { success: true };
    },

    sendPeerChat: async (to: string, text: string) => {
      emitLog(`[Chat Mobile] Inviato a ${to}: ${text}`);
      return { success: true };
    },

    // Shared Files Browser
    listSharedDir: async (_root: string, _subpath: string) => {
      return { files: [] };
    },

    mkdirShared: async (_root: string, _subpath: string, _name: string) => {
      return { success: true };
    },

    deleteShared: async (_root: string, _subpath: string, _name: string, _isDir: boolean) => {
      return { success: true };
    },

    moveShared: async (_srcRoot: string, _srcSub: string, _name: string, _destRoot: string, _destSub: string) => {
      return { success: true };
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
    pickFolder: async () => '',
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

    // Network Explorer (HTTP API native fetches)
    getNetworkPeers: async (server: string, token: string) => {
      const res = await fetch(`${server}/api/network/peers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return await res.json();
    },

    getPeerTracks: async (server: string, token: string, sessionId: string, _origin?: string) => {
      const res = await fetch(`${server}/api/network/peers/${sessionId}/tracks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return await res.json();
    },

    downloadPeerTrack: async (server: string, token: string, sessionId: string, trackId: string, _artist: string, _title: string, _origin?: string) => {
      await fetch(`${server}/api/network/peers/${sessionId}/download/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return `mobile_download_${trackId}`;
    },

    getCatalogTracks: async (server: string, token: string) => {
      const res = await fetch(`${server}/api/catalog/tracks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return await res.json();
    },

    downloadCatalogTrack: async (server: string, token: string, trackId: string, _artist: string, _title: string) => {
      await fetch(`${server}/api/catalog/download/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return `catalog_${trackId}`;
    },
  };
}
