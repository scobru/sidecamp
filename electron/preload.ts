import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Uploader
  setUploadConfig: (server: string, token: string) => ipcRenderer.invoke('upload:config', server, token),
  uploadTrack: (filePath: string, metadata: any) => ipcRenderer.invoke('upload:track', filePath, metadata),
  
  // Soulseek
  slskConnect: (user: string, pass: string) => ipcRenderer.invoke('slsk:connect', user, pass),
  slskSearch: (query: string) => ipcRenderer.invoke('slsk:search', query),
  slskDownload: (result: any) => ipcRenderer.invoke('slsk:download', result),
  slskStatus: () => ipcRenderer.invoke('slsk:status'),
  
  // Torrent
  torrentDownload: (magnetUri: string) => ipcRenderer.invoke('torrent:download', magnetUri),
  
  // Ytdlp
  ytdlpDownload: (url: string) => ipcRenderer.invoke('ytdlp:download', url),
  
  // Peer Daemon
  startPeer: (config: any) => ipcRenderer.invoke('peer:start', config),
  stopPeer: () => ipcRenderer.invoke('peer:stop'),
  
  // Events listener (log, progress, status)
  onPeerLog: (callback: (msg: string) => void) => ipcRenderer.on('peer:log', (_, msg) => callback(msg)),
  onPeerStatus: (callback: (status: string) => void) => ipcRenderer.on('peer:status', (_, status) => callback(status)),
  onPeerProgress: (callback: (data: any) => void) => ipcRenderer.on('peer:progress', (_, data) => callback(data)),
})
// End of file
