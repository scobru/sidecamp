import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron'
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
ipcMain.handle('downloads:list', async () => {
  try {
    if (!fs.existsSync(downloadDir)) {
      return [];
    }
    
    const files = fs.readdirSync(downloadDir, { withFileTypes: true });
    const result = [];
    
    for (const f of files) {
      if (f.isFile()) {
        const filePath = path.join(downloadDir, f.name);
        const ext = path.extname(f.name).toLowerCase();
        if (['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.mp4'].includes(ext)) {
          const stat = fs.statSync(filePath);
          result.push({
            name: f.name,
            path: filePath,
            size: stat.size,
            ctime: stat.ctimeMs,
            magnetUri: torrent.getMagnetUriForFile(filePath)
          });
        }
      } else if (f.isDirectory()) {
        const subDirPath = path.join(downloadDir, f.name);
        const subFiles = fs.readdirSync(subDirPath, { withFileTypes: true });
        for (const sf of subFiles) {
          if (sf.isFile()) {
            const filePath = path.join(subDirPath, sf.name);
            const ext = path.extname(sf.name).toLowerCase();
            if (['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.mp4'].includes(ext)) {
              const stat = fs.statSync(filePath);
              result.push({
                name: `${f.name}/${sf.name}`,
                path: filePath,
                size: stat.size,
                ctime: stat.ctimeMs,
                magnetUri: torrent.getMagnetUriForFile(filePath)
              });
            }
          }
        }
      }
    }
    
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
    await shell.openPath(filePath);
    return true;
  } catch (e) {
    console.error("Error opening file:", e);
    throw e;
  }
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
  protocol.registerFileProtocol('media', (request, callback) => {
    const filePath = decodeURIComponent(request.url.slice('media://'.length));
    callback({ path: filePath });
  });
  createWindow();
});
