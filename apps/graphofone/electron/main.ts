import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog, Menu } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { importFolder, loadLibrary, clearLibrary, saveGraph, loadGraph, readAudioFile, updateTrackMeta } from './library'
import * as fs from 'fs/promises'

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, corsEnabled: false } }
]);

process.env.DIST = join(import.meta.dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let win: BrowserWindow | null

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { label: 'File', submenu: [{ role: 'quit' }] },
    { role: 'editMenu' },
    {
      role: 'windowMenu',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] as any : [{ role: 'close' }])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => win?.webContents.toggleDevTools()
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#111827',
    icon: join(process.env.VITE_PUBLIC, 'logo.png'),
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow media:// and file:// fetching
    },
  })

  // IPC Handlers
  ipcMain.handle('library:import', () => importFolder());
  ipcMain.handle('library:load', () => loadLibrary());
  ipcMain.handle('library:clear', () => clearLibrary());
  ipcMain.handle('graph:save', (_, data) => saveGraph(data));
  ipcMain.handle('graph:load', () => loadGraph());
  ipcMain.handle('fs:readAudio', (_, path) => readAudioFile(path));
  ipcMain.handle('library:updateTrackMeta', (_, path, data) => updateTrackMeta(path, data));

  ipcMain.handle('app:saveRecording', async (_, defaultFilename: string, buffer: Uint8Array) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Save Recording',
      defaultPath: defaultFilename,
      filters: [{ name: 'WebM Audio', extensions: ['webm'] }]
    });
    if (canceled || !filePath) return false;
    try {
      await fs.writeFile(filePath, Buffer.from(buffer));
      return true;
    } catch (e) {
      console.error('Failed to save recording', e);
      return false;
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // win.webContents.openDevTools()
  } else {
    win.loadFile(join(process.env.DIST, 'index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  protocol.handle('media', (req) => {
    const urlStr = req.url.slice('media://'.length);
    const decodedUrl = decodeURIComponent(urlStr);
    const absolutePath = decodedUrl.replace(/^\/?/, '');
    const driveLetterMatch = absolutePath.match(/^([a-zA-Z]):\/(.*)/);
    const resolvedPath = driveLetterMatch
      ? `${driveLetterMatch[1]}:\\${driveLetterMatch[2].replace(/\//g, '\\')}`
      : `/${absolutePath}`;
    return net.fetch(pathToFileURL(resolvedPath).href, { bypassCustomProtocolHandlers: true });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
