import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Library APIs
  importFolder: () => ipcRenderer.invoke('library:import'),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  clearLibrary: () => ipcRenderer.invoke('library:clear'),
  saveGraph: (data: any) => ipcRenderer.invoke('graph:save', data),
  loadGraph: () => ipcRenderer.invoke('graph:load'),
  readAudioFile: (path: string) => ipcRenderer.invoke('fs:readAudio', path),
  updateTrackMeta: (path: string, data: any) => ipcRenderer.invoke('library:updateTrackMeta', path, data),
  saveRecording: (filename: string, buffer: Uint8Array) => ipcRenderer.invoke('app:saveRecording', filename, buffer),
  checkForUpdate: () => ipcRenderer.invoke('app:update-check'),
  openReleasesPage: () => ipcRenderer.invoke('app:open-releases'),

  // Listeners (if needed later)
  onNavigate: (callback: (tab: string) => void) => {
    ipcRenderer.removeAllListeners('nav:goto');
    ipcRenderer.on('nav:goto', (_, tab) => callback(tab));
  }
});
