import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } },
  { scheme: 'stream', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

process.env.DIST = join(import.meta.dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let win: BrowserWindow | null

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
import NodeID3 from 'node-id3';

let daemon: PeerDaemon | null = null;
const musicDir = path.join(app.getPath('music'), 'Sidecamp');
const downloadDir = path.join(app.getPath('downloads'), 'Sidecamp');

const slsk = new SoulseekService(musicDir, downloadDir);
const torrent = new TorrentService(downloadDir);
const ytdlp = new YtdlpService(downloadDir);
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

ipcMain.handle('downloads:list', async () => {
  try {
    try {
      await fs.promises.access(downloadDir, fs.constants.F_OK);
    } catch {
      return [];
    }

    const result = await scanAudioFiles(downloadDir, downloadDir);
    return result.sort((a, b) => b.ctime - a.ctime);
  } catch (e) {
    console.error("Error reading downloads directory:", e);
    return [];
  }
});

ipcMain.handle('downloads:delete', async (event, filePath) => {
  try {
    const normalizedPath = path.resolve(filePath);
    const normalizedDownloadDir = path.resolve(downloadDir);
    if (!normalizedPath.startsWith(normalizedDownloadDir + path.sep)) {
      throw new Error("Access denied: invalid path");
    }

    const exists = await fs.promises.access(normalizedPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.promises.unlink(normalizedPath);
      // Clean up empty directories
      const dir = path.dirname(normalizedPath);
      if (dir !== downloadDir) {
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
    if (!resolvedPath.startsWith(downloadDir + path.sep) && resolvedPath !== downloadDir) {
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

ipcMain.handle('downloads:write-tags', async (event, filePath, tags) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mp3') throw new Error(`Tag writing only supported for MP3 (got ${ext})`);
  const result = NodeID3.write(tags, filePath);
  if (result !== true) throw new Error(`NodeID3.write failed: ${result}`);
  return true;
});

ipcMain.handle('downloads:rename', async (event, filePath, newFilename) => {
  const dir = path.dirname(filePath);
  const destPath = path.join(dir, newFilename);
  await fs.promises.rename(filePath, destPath);
  return destPath;
});

ipcMain.handle('downloads:move', async (event, filePath, destFolder) => {
  const fileName = path.basename(filePath);
  const destPath = path.join(destFolder, fileName);
  await fs.promises.mkdir(destFolder, { recursive: true });
  await fs.promises.rename(filePath, destPath);
  return destPath;
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
      const genre = await lookupGenre(t.artist, t.title, net.fetch);
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
  protocol.handle('media', (request) => {
    const filePath = decodeURIComponent(request.url.slice('media://'.length));
    const absolutePath = path.resolve(filePath);
    const isMusic = absolutePath.startsWith(musicDir + path.sep) || absolutePath === musicDir;
    const isDownload = absolutePath.startsWith(downloadDir + path.sep) || absolutePath === downloadDir;

    if (!isMusic && !isDownload) {
      return new Response('Access Denied', { status: 403 });
    }

    return net.fetch(pathToFileURL(absolutePath).toString());
  });

  // Proxy remote audio streams from the TuneCamp server so the renderer can play
  // network tracks without exposing the token to the page origin or tripping CSP.
  // URL: stream://audio?url=<encoded server stream URL>&token=<encoded token>
  protocol.handle('stream', async (request) => {
    try {
      const u = new URL(request.url);
      const target = u.searchParams.get('url');
      const token = u.searchParams.get('token') || '';
      if (!target) return new Response('Bad Request', { status: 400 });
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const range = request.headers.get('range');
      if (range) headers['Range'] = range;
      return net.fetch(target, { headers });
    } catch (err: any) {
      return new Response('Stream error: ' + err.message, { status: 500 });
    }
  });

  createWindow();
});
