import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog, Menu, safeStorage } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'

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
  ['Library', 'library'],
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
import NodeID3 from 'node-id3';
import { getTracksMeta, setCachedAnalysis } from './track-meta';

const AUDIO_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.webm': 'audio/webm',
};

let daemon: PeerDaemon | null = null;
const musicDir = path.join(app.getPath('music'), 'Sidecamp');
const downloadDir = path.join(app.getPath('downloads'), 'Sidecamp');
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
const torrent = new TorrentService(downloadDir);
const ytdlp = new YtdlpService(downloadDir, path.join(app.getPath('userData'), 'bin'));
const network = new NetworkService(downloadDir);
const uploader = new TuneCampUploader({ server: '', token: '' }); // Configured later via IPC

// Forward torrent and ytdlp events to renderer
torrent.on('log', (msg) => win?.webContents.send('download:log', `[Torrent] ${msg}`));
torrent.on('progress', (data) => win?.webContents.send('download:progress', data));
ytdlp.on('log', (msg) => win?.webContents.send('download:log', `[YT-DLP] ${msg}`));

// --- Uploader IPC ---
ipcMain.handle('upload:config', (event, server, token) => {
  uploader.setConfig({ server, token });
  return true;
});

ipcMain.handle('upload:track', async (event, filePath, metadata) => {
  return await uploader.uploadTrack(filePath, metadata);
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

// --- Local Downloads Library IPC ---
const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.mp4', '.webm']);

async function scanAudioFiles(dir: string, baseDir: string): Promise<{ name: string; path: string; size: number; ctime: number; magnetUri: string }[]> {
  const result: { name: string; path: string; size: number; ctime: number; magnetUri: string }[] = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    const MAX_CONCURRENT = 50;
    for (let i = 0; i < entries.length; i += MAX_CONCURRENT) {
      const chunk = entries.slice(i, i + MAX_CONCURRENT);
      await Promise.all(chunk.map(async (f) => {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) {
          const subResult = await scanAudioFiles(full, baseDir);
          result.push(...subResult);
        } else if (f.isFile() && AUDIO_EXTS.has(path.extname(f.name).toLowerCase())) {
          try {
            const stat = await fs.promises.stat(full);
            if (stat.size > 0) {
              result.push({
                name: path.relative(baseDir, full),
                path: full,
                size: stat.size,
                ctime: stat.ctimeMs,
                magnetUri: torrent.getMagnetUriForFile(full)
              });
            }
          } catch (err) {
            // ignore stat errors (e.g., file deleted during scan)
          }
        }
      }));
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}:`, err);
  }
  return result;
}

ipcMain.handle('downloads:list', async (event, extraRoots?: string[]) => {
  try {
    // Scan the download dir plus any configured shared folders, deduped by
    // resolved path so a shared folder that equals downloadDir isn't double-scanned.
    if (extraRoots) setSharedRoots(extraRoots);
    const roots = [downloadDir, ...(Array.isArray(extraRoots) ? extraRoots : [])]
      .map(r => path.resolve(r))
      .filter((r, i, a) => a.indexOf(r) === i);

    const seen = new Set<string>();
    const merged: Awaited<ReturnType<typeof scanAudioFiles>> = [];
    for (const root of roots) {
      try {
        await fs.promises.access(root, fs.constants.F_OK);
      } catch {
        continue;
      }
      const files = await scanAudioFiles(root, root);
      for (const f of files) {
        if (seen.has(f.path)) continue;
        seen.add(f.path);
        merged.push(f);
      }
    }
    return merged.sort((a, b) => b.ctime - a.ctime);
  } catch (e) {
    console.error("Error reading downloads directory:", e);
    return [];
  }
});

ipcMain.handle('downloads:delete', async (event, filePath) => {
  try {
    const normalizedPath = path.resolve(filePath);
    if (!isUnderAllowedRoot(normalizedPath) || allowedRoots().includes(normalizedPath)) {
      throw new Error("Access denied: invalid path");
    }

    const exists = await fs.promises.access(normalizedPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.promises.unlink(normalizedPath);
      // Clean up empty directories, but never remove an allowed root itself.
      const dir = path.dirname(normalizedPath);
      if (!allowedRoots().includes(dir)) {
        const dirExists = await fs.promises.access(dir).then(() => true).catch(() => false);
        if (dirExists) {
          const files = await fs.promises.readdir(dir);
          if (files.length === 0) {
            await fs.promises.rmdir(dir);
          }
        }
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error("Error deleting file:", e);
    throw e;
  }
});

ipcMain.handle('downloads:open', async (event, filePath) => {
  try {
    const resolvedPath = path.resolve(filePath);
    if (!isUnderAllowedRoot(resolvedPath)) {
      throw new Error("Access denied: Path is outside the download directory");
    }
    await shell.openPath(resolvedPath);
    return true;
  } catch (e) {
    console.error("Error opening file:", e);
    throw e;
  }
});

ipcMain.handle('downloads:read-tags', async (event, filePath) => {
  const tags = NodeID3.read(filePath);
  return { title: tags.title || '', artist: tags.artist || '', album: tags.album || '' };
});

// Batch tag metadata for the Library table (title/artist/BPM/key/duration…), disk-cached per file.
ipcMain.handle('downloads:tracks-meta', async (event, paths: string[]) => {
  if (!Array.isArray(paths)) return {};
  return getTracksMeta(paths.filter(p => typeof p === 'string' && isUnderAllowedRoot(p)));
});

// Raw audio bytes for the renderer's Web Audio analysis. fetch('media://…') is CORS-blocked
// for non-standard schemes, so the renderer gets the bytes over IPC instead.
ipcMain.handle('downloads:read-file', async (event, filePath: string) => {
  if (typeof filePath !== 'string' || !isUnderAllowedRoot(filePath)) throw new Error('Access denied: invalid path');
  return fs.promises.readFile(filePath);
});

// Persist renderer Web Audio analysis (BPM and/or waveform peaks): TBPM tag for mp3, cache for all.
ipcMain.handle('downloads:set-analysis', async (event, filePath: string, data: { bpm?: number; peaks?: number[]; beatOffset?: number; cuePoint?: number | null; cueOutPoint?: number | null }) => {
  if (typeof filePath !== 'string' || !isUnderAllowedRoot(filePath) || !data || typeof data !== 'object') return false;
  const bpm = typeof data.bpm === 'number' && Number.isFinite(data.bpm) && data.bpm >= 40 && data.bpm <= 300 ? data.bpm : undefined;
  const peaks = Array.isArray(data.peaks) && data.peaks.length > 0 && data.peaks.length <= 400 ? data.peaks : undefined;
  const beatOffset = typeof data.beatOffset === 'number' && Number.isFinite(data.beatOffset) && data.beatOffset >= 0 && data.beatOffset < 3 ? data.beatOffset : undefined;
  const cuePoint = data.cuePoint === null ? null : (typeof data.cuePoint === 'number' && Number.isFinite(data.cuePoint) && data.cuePoint >= 0 ? data.cuePoint : undefined);
  const cueOutPoint = data.cueOutPoint === null ? null : (typeof data.cueOutPoint === 'number' && Number.isFinite(data.cueOutPoint) && data.cueOutPoint >= 0 ? data.cueOutPoint : undefined);
  if (!bpm && !peaks && beatOffset === undefined && cuePoint === undefined && cueOutPoint === undefined) return false;
  if (bpm && path.extname(filePath).toLowerCase() === '.mp3') {
    try { NodeID3.update({ bpm: String(Math.round(bpm)) }, filePath); } catch { /* tag write is best-effort */ }
  }
  await setCachedAnalysis(filePath, { bpm, peaks, beatOffset, cuePoint, cueOutPoint });
  return true;
});

ipcMain.handle('downloads:write-tags', async (event, filePath, tags) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mp3') throw new Error(`Tag writing only supported for MP3 (got ${ext})`);
  // update (merge) instead of write (replace): keeps tags we don't edit, e.g. TBPM/genre.
  const result = NodeID3.update(tags, filePath);
  if (result !== true) throw new Error(`NodeID3.update failed: ${result}`);
  return true;
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

ipcMain.handle('downloads:rename', async (event, filePath, newFilename) => {
  if (typeof filePath !== 'string' || !isUnderAllowedRoot(path.resolve(filePath)))
    throw new Error('Access denied: invalid path');
  const dir = path.dirname(path.resolve(filePath));
  // basename strips any path separators smuggled into the new filename
  const destPath = path.join(dir, path.basename(String(newFilename)));
  if (!isUnderAllowedRoot(destPath)) throw new Error('Access denied: invalid destination');
  await fs.promises.rename(filePath, destPath);
  return destPath;
});

ipcMain.handle('downloads:move', async (event, filePath, destFolder) => {
  if (typeof filePath !== 'string' || !isUnderAllowedRoot(path.resolve(filePath)))
    throw new Error('Access denied: invalid path');
  if (typeof destFolder !== 'string' || !isUnderAllowedRoot(path.resolve(destFolder)))
    throw new Error('Access denied: invalid destination');
  const fileName = path.basename(filePath);
  const destPath = path.join(destFolder, fileName);
  await fs.promises.mkdir(destFolder, { recursive: true });
  await fs.promises.rename(filePath, destPath);
  return destPath;
});

// Copy a playlist's tracks into a flat, CDJ-friendly folder: files renamed
// with a numeric order prefix plus a playlist.m3u8 listing them in order.
ipcMain.handle('playlist:export', async (event, destDir: string, folderName: string, items: { path: string; exportName: string }[]) => {
  if (!destDir || !Array.isArray(items)) return { error: 'Nothing to export' };
  const clean = String(folderName || 'Playlist').replace(/[<>:"/\\|?*]/g, '').trim() || 'Playlist';
  const target = path.join(path.resolve(destDir), clean);
  await fs.promises.mkdir(target, { recursive: true });
  const m3u = ['#EXTM3U'];
  let copied = 0;
  const errors: string[] = [];
  for (const it of items) {
    try {
      if (!isUnderAllowedRoot(it.path)) throw new Error('source outside library');
      await fs.promises.copyFile(it.path, path.join(target, it.exportName));
      m3u.push(it.exportName);
      copied++;
    } catch (e: any) {
      errors.push(`${it.exportName}: ${e.message}`);
    }
  }
  // CRLF + UTF-8 for maximum USB/CDJ compatibility.
  await fs.promises.writeFile(path.join(target, 'playlist.m3u8'), m3u.join('\r\n') + '\r\n', 'utf8');
  return { target, copied, total: items.length, errors };
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

ipcMain.handle('dialog:save-file', async (event, filename: string, content: string) => {
  const result = win
    ? await dialog.showSaveDialog(win, { defaultPath: filename, filters: [{ name: 'JSON', extensions: ['json'] }] })
    : await dialog.showSaveDialog({ defaultPath: filename, filters: [{ name: 'JSON', extensions: ['json'] }] });
  win?.webContents.focus();
  if (result.canceled || !result.filePath) return null;
  await fs.promises.writeFile(result.filePath, content, 'utf8');
  return result.filePath;
});

ipcMain.handle('dialog:open-file', async () => {
  const result = win
    ? await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
    : await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  win?.webContents.focus();
  if (result.canceled || result.filePaths.length === 0) return null;
  const content = await fs.promises.readFile(result.filePaths[0], 'utf8');
  return { filePath: result.filePaths[0], content };
});

// --- Torrent IPC ---
ipcMain.handle('torrent:download', async (event, magnetUri, downloadId) => {
  return await torrent.download(magnetUri, downloadId);
});

ipcMain.handle('torrent:seed', async (event, input, torrentName) => {
  const magnetUri = await torrent.seed(input, torrentName);
  if (daemon) {
    daemon.rescanAndSendManifest();
  }
  return magnetUri;
});

ipcMain.handle('torrent:remove', async (event, infoHash) => {
  await torrent.remove(infoHash);
  if (daemon) {
    daemon.rescanAndSendManifest();
  }
  return true;
});

// --- Yt-dlp IPC ---
ipcMain.handle('ytdlp:download', async (event, url) => {
  return await ytdlp.download(url);
});

// --- Peer Daemon IPC ---
ipcMain.handle('peer:start', async (event, config: PeerConfig) => {
  if (daemon) daemon.stop();
  setSharedRoots(config.folders);
  daemon = new PeerDaemon(config, (filePath) => torrent.getMagnetUriForFile(filePath));
  
  daemon.on('log', (msg) => win?.webContents.send('peer:log', msg));
  daemon.on('status', (status) => win?.webContents.send('peer:status', status));
  daemon.on('progress', (current, total) => win?.webContents.send('peer:progress', { current, total }));
  daemon.on('chat', (data) => win?.webContents.send('peer:chat', data));

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

ipcMain.handle('peer:chat-send', (event, to: string, text: string) => {
  daemon?.sendChat(to, text);
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
  // Browsing a root also whitelists it for media:// playback, so clicking a
  // track in Shared Files works even if the Library scan never ran.
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
// Cached for the process lifetime: one GitHub API hit per app launch.
const RELEASES_URL = 'https://github.com/scobru/sidecamp/releases/latest';
let updateCheckResult: { currentVersion: string; latestVersion: string | null; updateAvailable: boolean } | null = null;

ipcMain.handle('app:update-check', async () => {
  if (updateCheckResult) return updateCheckResult;
  const currentVersion = app.getVersion();
  let latestVersion: string | null = null;
  try {
    const res = await fetch('https://api.github.com/repos/scobru/sidecamp/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) latestVersion = ((await res.json() as { tag_name?: string }).tag_name ?? '').replace(/^v/, '') || null;
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

ipcMain.handle('app:open-releases', () => shell.openExternal(RELEASES_URL));

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

// --- Library Organizer IPC ---
import { scanDir, buildPlan, applyPlan, OrganizeMode, Track } from './organizer';
import { cacheGet, cachePut } from './organizer-cache';
import { lookupGenre } from './beatport';
import { lookupGenre as lookupGenreMB } from './musicbrainz';

ipcMain.handle('organize:scan', async (event, root: string, mode: OrganizeMode) => {
  if (!root) return { error: 'No folder selected' };
  try {
    const dirMtime = (await fs.promises.stat(root)).mtimeMs;
    let tracks = await cacheGet(root, dirMtime);
    if (!tracks) {
      tracks = await scanDir(root);
      await cachePut(root, dirMtime, tracks);
    }
    return buildPlan(tracks, root, mode);
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('organize:apply', async (event, root: string, actions: any[]) => {
  if (!root || !Array.isArray(actions)) return { error: 'Invalid request' };
  try {
    const result = await applyPlan(root, actions);
    // layout changed → cached scan is stale
    const dirMtime = (await fs.promises.stat(root)).mtimeMs;
    await cachePut(root, dirMtime, await scanDir(root));
    return result;
  } catch (err: any) {
    return { error: err.message };
  }
});

// Beatport genre fill: long-running (~1.4s/track, polite rate limit), so it
// streams progress events and supports cancellation via a simple flag.
let genreFillCancelled = false;

ipcMain.handle('organize:fill-genres-cancel', () => { genreFillCancelled = true; return true; });

ipcMain.handle('organize:fill-genres', async (event, root: string) => {
  if (!root) return { error: 'No folder selected' };
  genreFillCancelled = false;
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  try {
    const dirMtime = (await fs.promises.stat(root)).mtimeMs;
    const tracks: Track[] = (await cacheGet(root, dirMtime)) ?? await scanDir(root);
    const missing = tracks.filter(t => !t.genre && t.title);
    let found = 0, written = 0;
    for (let i = 0; i < missing.length; i++) {
      if (genreFillCancelled) break;
      const t = missing[i];
      // Beatport is authoritative for electronic/DJ tracks; anything it can't
      // classify (rock/pop/jazz/classical) falls back to MusicBrainz.
      const genre = await lookupGenre(t.artist, t.title, net.fetch)
        ?? await lookupGenreMB(t.artist, t.title, net.fetch);
      if (genre) {
        found++;
        t.genre = genre;
        // node-id3 only writes mp3; other formats keep the genre in the scan
        // cache so genre-mode organizing still works this session.
        if (t.ext === '.mp3') {
          try { if (NodeID3.update({ genre }, t.path) === true) written++; } catch { /* tag write is best-effort */ }
        }
      }
      win?.webContents.send('organize:genre-progress', { current: i + 1, total: missing.length, file: path.basename(t.path), genre: genre || null });
      await sleep(1400);
    }
    await cachePut(root, dirMtime, tracks);
    return { missing: missing.length, found, written, cancelled: genreFillCancelled };
  } catch (err: any) {
    return { error: err.message };
  }
});

// --- Network Explorer IPC ---
ipcMain.handle('network:peers', async (event, server, token) => {
  return await network.getPeers(server, token);
});

ipcMain.handle('network:tracks', async (event, server, token, sessionId) => {
  return await network.getPeerTracks(server, token, sessionId);
});

ipcMain.handle('network:download', async (event, server, token, sessionId, trackId, artist, title) => {
  return await network.downloadPeerTrack(server, token, sessionId, trackId, artist, title);
});

ipcMain.handle('network:catalog-tracks', async (event, server, token) => {
  return await network.getCatalogTracks(server, token);
});

ipcMain.handle('network:catalog-download', async (event, server, token, trackId, artist, title) => {
  return await network.downloadCatalogTrack(server, token, trackId, artist, title);
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
    const m = rangeHeader && /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    // Chromium aborts the in-flight request on every seek; destroy the file
    // stream then, or each seek leaks an open stream that keeps reading.
    const openStream = (opts?: { start: number; end: number }) => {
      const stream = fs.createReadStream(absolutePath, opts);
      request.signal.addEventListener('abort', () => stream.destroy());
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
        return await net.fetch(target, { headers });
      } catch (err: any) {
        if (attempt > 0) return new Response('Stream error: ' + err.message, { status: 502 });
        await new Promise(r => setTimeout(r, 400));
      }
    }
  });

  createWindow();
});
