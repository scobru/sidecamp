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
  torrentDownload: (magnetUri: string) => ipcRenderer.invoke('torrent:download', magnetUri),
  torrentSeed: (input: string | string[], torrentName?: string) => ipcRenderer.invoke('torrent:seed', input, torrentName),
  
  // Ytdlp
  ytdlpDownload: (url: string) => ipcRenderer.invoke('ytdlp:download', url),
  
  // Local downloads library
  listDownloads: () => ipcRenderer.invoke('downloads:list'),
  deleteDownload: (filePath: string) => ipcRenderer.invoke('downloads:delete', filePath),
  
  // Peer Daemon
  startPeer: (config: any) => ipcRenderer.invoke('peer:start', config),
  stopPeer: () => ipcRenderer.invoke('peer:stop'),
  sendPeerChat: (to: string, text: string) => ipcRenderer.invoke('peer:chat-send', to, text),

  // Events listener (log, progress, status)
  onPeerLog: (callback: (msg: string) => void) => ipcRenderer.on('peer:log', (_, msg) => callback(msg)),
  onPeerStatus: (callback: (status: string) => void) => ipcRenderer.on('peer:status', (_, status) => callback(status)),
  onPeerProgress: (callback: (data: any) => void) => ipcRenderer.on('peer:progress', (_, data) => callback(data)),
  onPeerChat: (callback: (data: { from: string; text: string; ts: number }) => void) => ipcRenderer.on('peer:chat', (_, data) => callback(data)),
  
  onDownloadLog: (callback: (msg: string) => void) => ipcRenderer.on('download:log', (_, msg) => callback(msg)),
  onDownloadProgress: (callback: (data: any) => void) => ipcRenderer.on('download:progress', (_, data) => callback(data)),
  
  openDownload: (filePath: string) => ipcRenderer.invoke('downloads:open', filePath),
  removeTorrent: (infoHash: string) => ipcRenderer.invoke('torrent:remove', infoHash),
  readTags: (filePath: string) => ipcRenderer.invoke('downloads:read-tags', filePath),
  writeTags: (filePath: string, tags: any) => ipcRenderer.invoke('downloads:write-tags', filePath, tags),
  renameDownload: (filePath: string, newFilename: string) => ipcRenderer.invoke('downloads:rename', filePath, newFilename),
  moveDownload: (filePath: string, destFolder: string) => ipcRenderer.invoke('downloads:move', filePath, destFolder),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),

  // Network Explorer
  getNetworkPeers: (server: string, token: string) => ipcRenderer.invoke('network:peers', server, token),
  getPeerTracks: (server: string, token: string, sessionId: string) => ipcRenderer.invoke('network:tracks', server, token, sessionId),
  downloadPeerTrack: (server: string, token: string, sessionId: string, trackId: string, artist: string, title: string) => ipcRenderer.invoke('network:download', server, token, sessionId, trackId, artist, title),
  getCatalogTracks: (server: string, token: string) => ipcRenderer.invoke('network:catalog-tracks', server, token),
  downloadCatalogTrack: (server: string, token: string, trackId: string, artist: string, title: string) => ipcRenderer.invoke('network:catalog-download', server, token, trackId, artist, title),
})
// End of file
