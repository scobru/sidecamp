import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  configGet: () => ipcRenderer.invoke('config:get'),
  configSet: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),

  // Soulseek
  slskConnect: (user: string, pass: string) => ipcRenderer.invoke('slsk:connect', user, pass),
  slskSearch: (query: string) => ipcRenderer.invoke('slsk:search', query),
  searchWeb: (query: string, source: string, server?: string, token?: string) => ipcRenderer.invoke('search:web', query, source, server, token),
  slskDownload: (result: any) => ipcRenderer.invoke('slsk:download', result),
  slskStatus: () => ipcRenderer.invoke('slsk:status'),
  
  // Torrent
  torrentDownload: (magnetUri: string, downloadId?: string) => ipcRenderer.invoke('torrent:download', magnetUri, downloadId),
  
  // Ytdlp
  ytdlpDownload: (url: string, downloadId?: string) => ipcRenderer.invoke('ytdlp:download', url, downloadId),
  
  // Peer Daemon
  startPeer: (config: any) => ipcRenderer.invoke('peer:start', config),
  stopPeer: () => ipcRenderer.invoke('peer:stop'),

  // Shared-folder file browser
  listSharedDir: (root: string, subpath: string) => ipcRenderer.invoke('fs:list', root, subpath),
  mkdirShared: (root: string, subpath: string, name: string) => ipcRenderer.invoke('fs:mkdir', root, subpath, name),
  deleteShared: (root: string, subpath: string, name: string, isDir: boolean) => ipcRenderer.invoke('fs:delete', root, subpath, name, isDir),
  moveShared: (srcRoot: string, srcSub: string, name: string, destRoot: string, destSub: string) => ipcRenderer.invoke('fs:move', srcRoot, srcSub, name, destRoot, destSub),
  getDownloadsDir: () => ipcRenderer.invoke('app:downloads-dir'),
  refocus: () => ipcRenderer.send('app:refocus'),
  setBackgroundThrottling: (throttle: boolean) => ipcRenderer.invoke('app:set-background-throttling', throttle),

  // Update check
  checkForUpdate: () => ipcRenderer.invoke('app:update-check'),
  openReleasesPage: () => ipcRenderer.invoke('app:open-releases'),

  // Events listener (log, progress, status). Each is a single logical
  // subscription — clear any previous listener first so a re-subscribe (React
  // StrictMode double-mount / remount) replaces it instead of stacking, which
  // would duplicate every log line and chat message.
  onPeerLog: (callback: (msg: string) => void) => { ipcRenderer.removeAllListeners('peer:log'); ipcRenderer.on('peer:log', (_, msg) => callback(msg)); },
  onPeerStatus: (callback: (status: string) => void) => { ipcRenderer.removeAllListeners('peer:status'); ipcRenderer.on('peer:status', (_, status) => callback(status)); },
  onPeerProgress: (callback: (data: any) => void) => { ipcRenderer.removeAllListeners('peer:progress'); ipcRenderer.on('peer:progress', (_, data) => callback(data)); },

  onNavGoto: (callback: (tab: string) => void) => { ipcRenderer.removeAllListeners('nav:goto'); ipcRenderer.on('nav:goto', (_, tab) => callback(tab)); },

  onDownloadLog: (callback: (msg: string) => void) => { ipcRenderer.removeAllListeners('download:log'); ipcRenderer.on('download:log', (_, msg) => callback(msg)); },
  onDownloadProgress: (callback: (data: any) => void) => { ipcRenderer.removeAllListeners('download:progress'); ipcRenderer.on('download:progress', (_, data) => callback(data)); },
  
  removeTorrent: (infoHash: string, deleteFiles?: boolean) => ipcRenderer.invoke('torrent:remove', infoHash, deleteFiles),
  saveRecording: (filename: string, data: Uint8Array) => ipcRenderer.invoke('recordings:save', filename, data),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),


  encryptString: (plain: string) => ipcRenderer.invoke('secure:encrypt', plain),
  decryptString: (stored: string) => ipcRenderer.invoke('secure:decrypt', stored),

  // Onboarding
  authConnect: (server: string, mode: 'login' | 'register', username: string, password: string) =>
    ipcRenderer.invoke('auth:connect', server, mode, username, password),

  // Network Explorer
  getNetworkPeers: (server: string, token: string) => ipcRenderer.invoke('network:peers', server, token),
  getPeerTracks: (server: string, token: string, sessionId: string, origin?: string) => ipcRenderer.invoke('network:tracks', server, token, sessionId, origin),
  downloadPeerTrack: (server: string, token: string, sessionId: string, trackId: string, artist: string, title: string, origin?: string, downloadId?: string) => ipcRenderer.invoke('network:download', server, token, sessionId, trackId, artist, title, origin, downloadId),
  getCatalogTracks: (server: string, token: string) => ipcRenderer.invoke('network:catalog-tracks', server, token),
  downloadCatalogTrack: (server: string, token: string, trackId: string, artist: string, title: string, downloadId?: string) => ipcRenderer.invoke('network:catalog-download', server, token, trackId, artist, title, downloadId),
  getCommunitySites: (server: string) => ipcRenderer.invoke('network:community-sites', server),
  getFederatedCatalog: (origin: string) => ipcRenderer.invoke('network:federated-catalog', origin),
  downloadFederatedCatalogTrack: (origin: string, trackId: string, artist: string, title: string, downloadId?: string) => ipcRenderer.invoke('network:federated-catalog-download', origin, trackId, artist, title, downloadId),
})
// End of file
