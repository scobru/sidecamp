import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
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
import { searchSoundCloud, searchBandcamp, searchTorrents } from './providers/search';
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
    return await searchTorrents(query, server, token);
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

function scanAudioFiles(dir: string, baseDir: string): { name: string; path: string; size: number; ctime: number; magnetUri: string }[] {
  const result = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      result.push(...scanAudioFiles(full, baseDir));
    } else if (f.isFile() && AUDIO_EXTS.has(path.extname(f.name).toLowerCase())) {
      const stat = fs.statSync(full);
      if (stat.size > 0) {
        result.push({
          name: path.relative(baseDir, full),
          path: full,
          size: stat.size,
          ctime: stat.ctimeMs,
          magnetUri: torrent.getMagnetUriForFile(full)
        });
      }
    }
  }
  return result;
}

ipcMain.handle('downloads:list', async () => {
  try {
    if (!fs.existsSync(downloadDir)) {
      return [];
    }

    const result = scanAudioFiles(downloadDir, downloadDir);
    return result.sort((a, b) => b.ctime - a.ctime);
  } catch (e) {
    console.error("Error reading downloads directory:", e);
    return [];
  }
});

ipcMain.handle('downloads:delete', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      // Clean up empty directories
      const dir = path.dirname(filePath);
      if (dir !== downloadDir && fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        if (files.length === 0) {
          fs.rmdirSync(dir);
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
  fs.renameSync(filePath, destPath);
  return destPath;
});

ipcMain.handle('downloads:move', async (event, filePath, destFolder) => {
  const fileName = path.basename(filePath);
  const destPath = path.join(destFolder, fileName);
  fs.mkdirSync(destFolder, { recursive: true });
  fs.renameSync(filePath, destPath);
  return destPath;
});

ipcMain.handle('dialog:pick-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

// --- Torrent IPC ---
ipcMain.handle('torrent:download', async (event, magnetUri) => {
  return await torrent.download(magnetUri);
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
    return net.fetch(pathToFileURL(filePath).toString());
  });
  createWindow();
});
