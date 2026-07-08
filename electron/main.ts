import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'

process.env.DIST = join(import.meta.dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.js'),
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
import { TuneCampUploader } from './uploader';
import path from 'path';

let daemon: PeerDaemon | null = null;
const musicDir = path.join(app.getPath('music'), 'Sidecamp');
const downloadDir = path.join(app.getPath('downloads'), 'Sidecamp');

const slsk = new SoulseekService(musicDir, downloadDir);
const torrent = new TorrentService(downloadDir);
const ytdlp = new YtdlpService(downloadDir);
const uploader = new TuneCampUploader({ server: '', token: '' }); // Configured later via IPC

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

ipcMain.handle('slsk:download', async (event, result) => {
  return await slsk.download(result);
});

ipcMain.handle('slsk:status', async () => {
  return await slsk.checkStatus();
});

// --- Torrent IPC ---
ipcMain.handle('torrent:download', async (event, magnetUri) => {
  return await torrent.download(magnetUri);
});

// --- Yt-dlp IPC ---
ipcMain.handle('ytdlp:download', async (event, url) => {
  return await ytdlp.download(url);
});

// --- Peer Daemon IPC ---
ipcMain.handle('peer:start', async (event, config: PeerConfig) => {
  if (daemon) daemon.stop();
  daemon = new PeerDaemon(config);
  
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

app.whenReady().then(createWindow)
