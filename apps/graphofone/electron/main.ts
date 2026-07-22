import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog, Menu } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { importFolder, loadLibrary, clearLibrary, saveGraph, loadGraph, readAudioFile, updateTrackMeta, updateTrackMetaBatch } from './library'
import * as fs from 'fs/promises'

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, corsEnabled: false } }
]);

process.env.DIST = join(import.meta.dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let win: BrowserWindow | null

// Sidecamp and graphofone ship independent versions from one shared repo, tagged
// `sidecamp-v*` / `graphofone-v*` — filter releases by prefix, not /releases/latest.
const TAG_PREFIX = 'graphofone-v';
const FALLBACK_RELEASES_URL = 'https://github.com/scobru/sidecamp/releases';
let releasesPageUrl = FALLBACK_RELEASES_URL;
// Cached for the process lifetime: one GitHub API hit per app launch.
let updateCheckResult: { currentVersion: string; latestVersion: string | null; updateAvailable: boolean } | null = null;

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
  ipcMain.handle('library:updateTrackMetaBatch', (_, updates) => updateTrackMetaBatch(updates));

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
