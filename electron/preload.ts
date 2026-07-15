import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Uploader
  setUploadConfig: (server: string, token: string) => ipcRenderer.invoke('upload:config', server, token),
  uploadTrack: (filePath: string, metadata: any) => ipcRenderer.invoke('upload:track', filePath, metadata),
  
  // Soulseek
  slskConnect: (user: string, pass: string) => ipcRenderer.invoke('slsk:connect', user, pass),
  slskSearch: (query: string) => ipcRenderer.invoke('slsk:search', query),
  searchWeb: (query: string, source: string, server?: string, token?: string) => ipcRenderer.invoke('search:web', query, source, server, token),
  slskDownload: (result: any) => ipcRenderer.invoke('slsk:download', result),
  slskStatus: () => ipcRenderer.invoke('slsk:status'),
  
  // Torrent
  torrentDownload: (magnetUri: string, downloadId?: string) => ipcRenderer.invoke('torrent:download', magnetUri, downloadId),
  torrentSeed: (input: string | string[], torrentName?: string) => ipcRenderer.invoke('torrent:seed', input, torrentName),
  
  // Ytdlp
  ytdlpDownload: (url: string) => ipcRenderer.invoke('ytdlp:download', url),
  
  // Local downloads library
  listDownloads: (extraRoots?: string[]) => ipcRenderer.invoke('downloads:list', extraRoots),
  deleteDownload: (filePath: string) => ipcRenderer.invoke('downloads:delete', filePath),
  
  // Peer Daemon
  startPeer: (config: any) => ipcRenderer.invoke('peer:start', config),
  stopPeer: () => ipcRenderer.invoke('peer:stop'),
  sendPeerChat: (to: string, text: string) => ipcRenderer.invoke('peer:chat-send', to, text),

  // Shared-folder file browser
  listSharedDir: (root: string, subpath: string) => ipcRenderer.invoke('fs:list', root, subpath),
  mkdirShared: (root: string, subpath: string, name: string) => ipcRenderer.invoke('fs:mkdir', root, subpath, name),
  deleteShared: (root: string, subpath: string, name: string, isDir: boolean) => ipcRenderer.invoke('fs:delete', root, subpath, name, isDir),
  moveShared: (srcRoot: string, srcSub: string, name: string, destRoot: string, destSub: string) => ipcRenderer.invoke('fs:move', srcRoot, srcSub, name, destRoot, destSub),
  getDownloadsDir: () => ipcRenderer.invoke('app:downloads-dir'),

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
  onPeerChat: (callback: (data: { from: string; text: string; ts: number }) => void) => { ipcRenderer.removeAllListeners('peer:chat'); ipcRenderer.on('peer:chat', (_, data) => callback(data)); },

  onNavGoto: (callback: (tab: string) => void) => { ipcRenderer.removeAllListeners('nav:goto'); ipcRenderer.on('nav:goto', (_, tab) => callback(tab)); },

  onDownloadLog: (callback: (msg: string) => void) => { ipcRenderer.removeAllListeners('download:log'); ipcRenderer.on('download:log', (_, msg) => callback(msg)); },
  onDownloadProgress: (callback: (data: any) => void) => { ipcRenderer.removeAllListeners('download:progress'); ipcRenderer.on('download:progress', (_, data) => callback(data)); },
  
  openDownload: (filePath: string) => ipcRenderer.invoke('downloads:open', filePath),
  removeTorrent: (infoHash: string) => ipcRenderer.invoke('torrent:remove', infoHash),
  readTags: (filePath: string) => ipcRenderer.invoke('downloads:read-tags', filePath),
  getTracksMeta: (paths: string[]) => ipcRenderer.invoke('downloads:tracks-meta', paths),
  setTrackAnalysis: (filePath: string, data: { bpm?: number; peaks?: number[]; beatOffset?: number; cuePoint?: number | null; cueOutPoint?: number | null }) => ipcRenderer.invoke('downloads:set-analysis', filePath, data),
  saveRecording: (filename: string, data: Uint8Array) => ipcRenderer.invoke('recordings:save', filename, data),
  readAudioFile: (filePath: string) => ipcRenderer.invoke('downloads:read-file', filePath),
  writeTags: (filePath: string, tags: any) => ipcRenderer.invoke('downloads:write-tags', filePath, tags),
  renameDownload: (filePath: string, newFilename: string) => ipcRenderer.invoke('downloads:rename', filePath, newFilename),
  moveDownload: (filePath: string, destFolder: string) => ipcRenderer.invoke('downloads:move', filePath, destFolder),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  exportPlaylist: (destDir: string, folderName: string, items: { path: string; exportName: string }[]) => ipcRenderer.invoke('playlist:export', destDir, folderName, items),

  // Library Organizer
  organizeScan: (root: string, mode: string) => ipcRenderer.invoke('organize:scan', root, mode),
  organizeApply: (root: string, actions: any[]) => ipcRenderer.invoke('organize:apply', root, actions),
  organizeFillGenres: (root: string) => ipcRenderer.invoke('organize:fill-genres', root),
  organizeFillGenresCancel: () => ipcRenderer.invoke('organize:fill-genres-cancel'),
  onGenreProgress: (callback: (data: { current: number; total: number; file: string; genre: string | null }) => void) => { ipcRenderer.removeAllListeners('organize:genre-progress'); ipcRenderer.on('organize:genre-progress', (_, data) => callback(data)); },

  // Network Explorer
  getNetworkPeers: (server: string, token: string) => ipcRenderer.invoke('network:peers', server, token),
  getPeerTracks: (server: string, token: string, sessionId: string) => ipcRenderer.invoke('network:tracks', server, token, sessionId),
  downloadPeerTrack: (server: string, token: string, sessionId: string, trackId: string, artist: string, title: string) => ipcRenderer.invoke('network:download', server, token, sessionId, trackId, artist, title),
  getCatalogTracks: (server: string, token: string) => ipcRenderer.invoke('network:catalog-tracks', server, token),
  downloadCatalogTrack: (server: string, token: string, trackId: string, artist: string, title: string) => ipcRenderer.invoke('network:catalog-download', server, token, trackId, artist, title),
})
// End of file
