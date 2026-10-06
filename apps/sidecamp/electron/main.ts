import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog, Menu, safeStorage } from 'electron'
import { join } from 'path'

// Windows-only bug: Chromium's native window-occlusion tracking can leave a minimized
// window unable to restore after switching away and back. Disable it.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
}

protocol.registerSchemesAsPrivileged([
  // corsEnabled: false — renderer fetch() of media:// (waveform/BPM analysis) comes from an
  // http/file origin and would otherwise be blocked by CORS for custom schemes.
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, corsEnabled: false } },
  { scheme: 'stream', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, corsEnabled: false } }
]);

process.env.DIST = join(import.meta.dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let win: BrowserWindow | null

// Native menu mirrors the sidebar sections with Ctrl+1..9 accelerators.
const NAV_SECTIONS: [string, string][] = [
  ['Search', 'download'],
  ['Upload', 'upload'],
  ['Graph', 'graph'],
  ['Network', 'network'],
  ['Sharing', 'peer'],
  ['Settings', 'settings'],
];

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { label: 'File', submenu: [{ role: 'quit' }] },
    { role: 'editMenu' },
    {
      label: 'Go',
      submenu: NAV_SECTIONS.map(([label, tab], i) => ({
        label,
        accelerator: `CmdOrCtrl+${i + 1}`,
        click: () => win?.webContents.send('nav:goto', tab),
      })),
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // Only disabled while a track is actually playing (see 'app:set-background-throttling'
      // below) — leaving it permanently off pegs the renderer at full tilt even while idle
      // and minimized, which is what caused Windows to mark the window "Not Responding".
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(process.env.DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

import { PeerDaemon, PeerConfig } from './peer/daemon';
import { SoulseekService } from './providers/soulseek';
import { TorrentService } from './providers/torrent';
import { YtdlpService } from './providers/ytdlp';
import { NetworkService } from './providers/network';
import { TuneCampUploader } from './uploader';
import { searchSoundCloud, searchBandcamp, searchTorrents, searchPeerNetwork, searchArchiveOrg } from './providers/search';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

const AUDIO_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.webm': 'audio/webm',
};

let daemon: PeerDaemon | null = null;

// Simple JSON config persisted in userData. Used for settings that the
// main process needs at startup (e.g. torrent port) — values the renderer
// also keeps in localStorage for quick access.
const configPath = join(app.getPath('userData'), 'config.json');
function readConfig(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { return {}; }
}
function writeConfig(cfg: Record<string, any>) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
}

const config = readConfig();

// User can point the whole Sidecamp library (music + downloads) at a custom
// folder via Settings; otherwise it defaults to the OS Music/Downloads dirs.
// This is distinct from config.folders, the extra shared-with-peers roots.
const libraryBase = config.libraryDir ? path.join(config.libraryDir, 'Sidecamp') : null;
const musicDir = libraryBase ? path.join(libraryBase, 'Music') : path.join(app.getPath('music'), 'Sidecamp');
const downloadDir = libraryBase ? path.join(libraryBase, 'Downloads') : path.join(app.getPath('downloads'), 'Sidecamp');
// Extra shared-folder roots (resolved) the user configured. Kept in sync from
// peer:start and downloads:list so the media:// protocol can serve their files.
let sharedRoots: string[] = [];
const setSharedRoots = (roots: unknown) => {
  if (!Array.isArray(roots)) return;
  sharedRoots = roots.filter(r => typeof r === 'string' && r).map(r => path.resolve(r as string));
};
const addSharedRoot = (root: string) => {
  const r = path.resolve(root);
  if (!sharedRoots.includes(r)) sharedRoots.push(r);
};
// A path is serveable/deletable if it sits inside the music dir, the download
// dir, or any configured shared root.
const allowedRoots = () => [path.resolve(musicDir), path.resolve(downloadDir), ...sharedRoots];
const isUnderAllowedRoot = (p: string) => {
  const abs = path.resolve(p);
  return allowedRoots().some(base => abs === base || abs.startsWith(base + path.sep));
};

const slsk = new SoulseekService(musicDir, downloadDir);
const torrent = new TorrentService(downloadDir, config.torrentPort);
const ytdlp = new YtdlpService(downloadDir, path.join(app.getPath('userData'), 'bin'));
const network = new NetworkService(downloadDir);
const uploader = new TuneCampUploader({ server: '', token: '' }); // Configured later via IPC

// Forward torrent and ytdlp events to renderer
torrent.on('log', (msg) => win?.webContents.send('download:log', `[Torrent] ${msg}`));
torrent.on('progress', (data) => win?.webContents.send('download:progress', data));
ytdlp.on('log', (msg) => win?.webContents.send('download:log', `[YT-DLP] ${msg}`));
ytdlp.on('progress', (data) => win?.webContents.send('download:progress', data));
network.on('progress', (data) => win?.webContents.send('download:progress', data));

ipcMain.handle('upload:config', (event, server, token) => {
  uploader.setConfig({ server, token });
  return { success: true };
});

ipcMain.handle('upload:track', async (event, filePath, metadata) => {
  return await uploader.uploadTrack(filePath, metadata);
});

ipcMain.handle('app:set-background-throttling', (_event, throttle: boolean) => {
  win?.webContents.setBackgroundThrottling(throttle);
});

// --- Soulseek IPC ---
ipcMain.handle('slsk:connect', async (event, user, pass) => {
  return await slsk.connect(user, pass);
});

ipcMain.handle('slsk:search', async (event, query) => {
  return await slsk.search(query);
});

ipcMain.handle('search:web', async (event, query, source, server, token) => {
  if (source === 'soundcloud') {
    return await searchSoundCloud(query);
  } else if (source === 'bandcamp') {
    return await searchBandcamp(query);
  } else if (source === 'torrent') {
    return await searchTorrents(query);
  } else if (source === 'network') {
    return await searchPeerNetwork(query, server, token);
  } else if (source === 'archive') {
    return await searchArchiveOrg(query);
  } else if (source === 'youtube') {
    return await ytdlp.search(query);
  }
  return [];
});

ipcMain.handle('slsk:download', async (event, result) => {
  return await slsk.download(result);
});

ipcMain.handle('slsk:status', async () => {
  return await slsk.checkStatus();
});

// Secrets at rest: renderer stores credentials encrypted with the OS keychain.
// decrypt falls back to returning the input so legacy plaintext values keep working
// (they get re-encrypted on the next settings save).
ipcMain.handle('secure:encrypt', (_event, plain) => {
  if (typeof plain !== 'string') throw new Error('Invalid input');
  if (!safeStorage.isEncryptionAvailable()) return plain;
  return safeStorage.encryptString(plain).toString('base64');
});
ipcMain.handle('secure:decrypt', (_event, stored) => {
  if (typeof stored !== 'string') throw new Error('Invalid input');
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    return stored; // legacy plaintext value
  }
});

ipcMain.handle('dialog:pick-folder', async () => {
  // Parent the dialog to the window and re-focus the webContents afterward.
  // Without this, on Windows the renderer loses input focus when the native
  // dialog closes and text inputs stop accepting clicks until a page reload.
  const result = win
    ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    : await dialog.showOpenDialog({ properties: ['openDirectory'] });
  win?.webContents.focus();
  return result.canceled ? null : result.filePaths[0];
});

// Native alert()/confirm() in the renderer leave Windows with a dead webContents
// (inputs ignore clicks/typing). blur+focus on the window restores it.
ipcMain.on('app:refocus', () => {
  if (!win) return;
  win.blur();
  win.focus();
  win.webContents.focus();
});

// --- Torrent IPC ---
ipcMain.handle('torrent:download', async (event, magnetUri, downloadId) => {
  return await torrent.download(magnetUri, downloadId);
});

ipcMain.handle('torrent:remove', async (event, infoHash, deleteFiles = false) => {
  await torrent.remove(infoHash, deleteFiles);
  if (daemon) {
    daemon.refreshAndSendManifest();
  }
  return true;
});

// --- Config IPC (persists settings the main process needs at startup) ---
ipcMain.handle('config:get', () => readConfig());
ipcMain.handle('config:set', (_event, key: string, value: any) => {
  const cfg = readConfig();
  cfg[key] = value;
  writeConfig(cfg);
  return true;
});

// --- Yt-dlp IPC ---
ipcMain.handle('ytdlp:download', async (event, url, downloadId) => {
  return await ytdlp.download(url, downloadId);
});

// --- Peer Daemon IPC ---
ipcMain.handle('peer:start', async (event, config: PeerConfig) => {
  if (daemon) daemon.stop();
  setSharedRoots(config.folders);
  daemon = new PeerDaemon(config, (filePath) => torrent.getMagnetUriForFile(filePath));
  
  daemon.on('log', (msg) => win?.webContents.send('peer:log', msg));
  daemon.on('status', (status) => win?.webContents.send('peer:status', status));
  daemon.on('progress', (current, total) => win?.webContents.send('peer:progress', { current, total }));

  await daemon.start();
  return true;
});

ipcMain.handle('peer:stop', () => {
  if (daemon) {
    daemon.stop();
    daemon = null;
  }
  return true;
});

// --- Shared-folder file browser IPC ---
// Guard: a resolved target must stay within the given shared-folder root, so a
// crafted subpath (../) can't escape into the rest of the filesystem.
function insideRoot(root: string, target: string): boolean {
  const r = path.resolve(root);
  const t = path.resolve(target);
  return t === r || t.startsWith(r + path.sep);
}

ipcMain.handle('fs:list', async (event, root: string, subpath: string) => {
  if (!root) return { error: 'No folder selected' };
  const resolvedRoot = path.resolve(root);
  if (!isUnderAllowedRoot(resolvedRoot)) return { error: 'Access denied: Path is outside allowed directories' };
  // Browsing a root also whitelists it for media:// playback, so clicking a
  // track in Shared Files works.
  addSharedRoot(root);
  const target = path.resolve(root, subpath || '');
  if (!insideRoot(root, target)) return { error: 'Invalid path' };
  try {
    const dirents = await fs.promises.readdir(target, { withFileTypes: true });
    const entries = dirents
      .map(d => ({ name: d.name, isDir: d.isDirectory() }))
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    return { entries };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:mkdir', async (event, root: string, subpath: string, name: string) => {
  const clean = String(name || '').replace(/[<>:"/\\|?*]/g, '').trim();
  if (!clean) return { error: 'Invalid folder name' };
  const target = path.resolve(root, subpath || '', clean);
  if (!insideRoot(root, target)) return { error: 'Invalid path' };
  try {
    await fs.promises.mkdir(target, { recursive: true });
    return { ok: true };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:delete', async (event, root: string, subpath: string, name: string, isDir: boolean) => {
  if (!name) return { error: 'Nothing to delete' };
  const target = path.resolve(root, subpath || '', name);
  // Must stay strictly inside the root — never allow deleting the root itself.
  if (!insideRoot(root, target) || target === path.resolve(root)) return { error: 'Invalid path' };
  try {
    await fs.promises.rm(target, { recursive: !!isDir, force: false });
    return { ok: true };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('app:downloads-dir', () => downloadDir);

// Save a recorded DJ set (graph playback capture) into <downloads>/recordings.
ipcMain.handle('recordings:save', async (event, filename: string, data: Uint8Array) => {
  if (typeof filename !== 'string' || !data) throw new Error('Invalid recording');
  const safeName = path.basename(filename).replace(/[^\w.\-]/g, '_');
  const dir = path.join(downloadDir, 'recordings');
  await fs.promises.mkdir(dir, { recursive: true });
  const dest = path.join(dir, safeName);
  await fs.promises.writeFile(dest, Buffer.from(data));
  return dest;
});

// --- Update check against GitHub releases ---
// Releases are tagged `sidecamp-v*` — filter by prefix, not /releases/latest.
const TAG_PREFIX = 'sidecamp-v';
const FALLBACK_RELEASES_URL = 'https://github.com/scobru/sidecamp/releases';
let releasesPageUrl = FALLBACK_RELEASES_URL;
// Cached for the process lifetime: one GitHub API hit per app launch.
let updateCheckResult: { currentVersion: string; latestVersion: string | null; updateAvailable: boolean } | null = null;

ipcMain.handle('app:update-check', async () => {
  if (updateCheckResult) return updateCheckResult;
  const currentVersion = app.getVersion();
  let latestVersion: string | null = null;
  try {
    const res = await fetch('https://api.github.com/repos/scobru/sidecamp/releases?per_page=30', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const releases = await res.json() as { tag_name?: string; html_url?: string }[];
      const match = releases.find(r => r.tag_name?.startsWith(TAG_PREFIX));
      if (match?.tag_name) {
        latestVersion = match.tag_name.slice(TAG_PREFIX.length) || null;
        if (match.html_url) releasesPageUrl = match.html_url;
      }
    }
  } catch { /* offline: report no update, retry next launch */ }
  const cmp = (a: string, b: string) => {
    const pa = a.split('.').map(n => parseInt(n, 10) || 0);
    const pb = b.split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
    return 0;
  };
  updateCheckResult = {
    currentVersion,
    latestVersion,
    updateAvailable: latestVersion !== null && cmp(latestVersion, currentVersion) > 0,
  };
  return updateCheckResult;
});

ipcMain.handle('app:open-releases', () => shell.openExternal(releasesPageUrl));

ipcMain.handle('fs:move', async (event, srcRoot: string, srcSub: string, name: string, destRoot: string, destSub: string) => {
  if (!name) return { error: 'Nothing to move' };
  const src = path.resolve(srcRoot, srcSub || '', name);
  const dest = path.resolve(destRoot, destSub || '', name);
  if (!insideRoot(srcRoot, src) || src === path.resolve(srcRoot)) return { error: 'Invalid source' };
  if (!insideRoot(destRoot, dest)) return { error: 'Invalid destination' };
  if (src === dest) return { error: 'Source and destination are the same' };
  try {
    if (fs.existsSync(dest)) return { error: 'An item with that name already exists there' };
    try {
      await fs.promises.rename(src, dest);
    } catch (err: any) {
      // rename fails across volumes (EXDEV) — copy then remove instead.
      if (err.code === 'EXDEV') {
        await fs.promises.cp(src, dest, { recursive: true });
        await fs.promises.rm(src, { recursive: true, force: true });
      } else throw err;
    }
    return { ok: true };
  } catch (err: any) {
    return { error: err.message };
  }
});

// --- Onboarding ---
ipcMain.handle('auth:connect', async (event, server, mode, username, password) => {
  return await network.authConnect(server, mode, username, password);
});

// --- Network Explorer IPC ---
ipcMain.handle('network:peers', async (event, server, token) => {
  return await network.getPeers(server, token);
});

ipcMain.handle('network:tracks', async (event, server, token, sessionId, origin) => {
  return await network.getPeerTracks(server, token, sessionId, origin);
});

ipcMain.handle('network:download', async (event, server, token, sessionId, trackId, artist, title, origin, downloadId) => {
  return await network.downloadPeerTrack(server, token, sessionId, trackId, artist, title, origin, downloadId);
});

ipcMain.handle('network:catalog-tracks', async (event, server, token) => {
  return await network.getCatalogTracks(server, token);
});

ipcMain.handle('network:catalog-download', async (event, server, token, trackId, artist, title, downloadId) => {
  return await network.downloadCatalogTrack(server, token, trackId, artist, title, downloadId);
});

ipcMain.handle('network:community-sites', async (event, server) => {
  return await network.getCommunitySites(server);
});

ipcMain.handle('network:federated-catalog', async (event, origin) => {
  return await network.getFederatedCatalog(origin);
});

ipcMain.handle('network:federated-catalog-download', async (event, origin, trackId, artist, title, downloadId) => {
  return await network.downloadFederatedCatalogTrack(origin, trackId, artist, title, downloadId);
});

app.whenReady().then(() => {
  buildMenu();

  protocol.handle('media', async (request) => {
    const filePath = decodeURIComponent(request.url.slice('media://'.length));
    const absolutePath = path.resolve(filePath);
    if (!isUnderAllowedRoot(absolutePath)) {
      return new Response('Access Denied', { status: 403 });
    }

    // Serve with byte-range support so the <audio> element can read duration
    // and seek. net.fetch(file://) ignores Range, which left tracks unseekable
    // and showing 0:00 duration.
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(absolutePath);
    } catch {
      return new Response('Not Found', { status: 404 });
    }
    const total = stat.size;
    const mime = AUDIO_MIME[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream';
    const rangeHeader = request.headers.get('Range');
    const m = rangeHeader && /bytes=\s*(\d*)\s*-\s*(\d*)/.exec(rangeHeader);
    // Chromium aborts the in-flight request on every seek. Cleanly destroy the stream
    // and suppress abort/close errors so Readable.toWeb doesn't bubble unhandled stream failures.
    const openStream = (opts?: { start: number; end: number }) => {
      const stream = fs.createReadStream(absolutePath, opts);
      stream.on('error', () => {});
      if (request.signal.aborted) {
        stream.destroy();
      } else {
        request.signal.addEventListener('abort', () => stream.destroy(), { once: true });
      }
      return Readable.toWeb(stream) as any;
    };
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (!Number.isFinite(start) || start < 0) start = 0;
      if (!Number.isFinite(end) || end >= total) end = total - 1;
      if (start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
      }
      return new Response(openStream({ start, end }), {
        status: 206,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }
    return new Response(openStream(), {
      status: 200,
      headers: { 'Content-Type': mime, 'Content-Length': String(total), 'Accept-Ranges': 'bytes' },
    });
  });

  // Proxy remote audio streams from the TuneCamp server so the renderer can play
  // network tracks without exposing the token to the page origin or tripping CSP.
  // URL: stream://audio?url=<encoded server stream URL>&token=<encoded token>
  protocol.handle('stream', async (request) => {
    const u = new URL(request.url);
    const target = u.searchParams.get('url');
    const token = u.searchParams.get('token') || '';
    if (!target) return new Response('Bad Request', { status: 400 });
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const range = request.headers.get('range');
    if (range) headers['Range'] = range;
    // Remote federated streams occasionally drop the connection (transient
    // network blip) — one retry after a short delay covers most of those
    // instead of surfacing net::ERR_FAILED / NotSupportedError to the player.
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await net.fetch(target, { headers });
        // A transient server hiccup (5xx) or not-yet-refreshed token (401) forwarded
        // as-is would hand <audio> a non-audio body, surfacing as NotSupportedError
        // instead of the real cause — retry once before giving up.
        if (!res.ok && attempt === 0) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        return res;
      } catch (err: any) {
        if (attempt > 0) return new Response('Stream error: ' + err.message, { status: 502 });
        await new Promise(r => setTimeout(r, 400));
      }
    }
  });

  createWindow();
});
