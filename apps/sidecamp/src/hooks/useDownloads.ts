import { useState } from 'react';

export function useDownloads() {
  const [dlLogs, setDlLogs] = useState<string[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<any[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<any[]>([]);

  const addLog = (msg: string) => {
    setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  };

  const updateDownload = (data: any) => {
    setActiveDownloads(prev => {
      const index = prev.findIndex(d => d.id === data.id);
      if (index > -1) {
        const updated = [...prev];
        updated[index] = { ...updated[index], ...data, status: data.seeding ? 'seeding' : (data.progress >= 1 ? 'completed' : 'downloading') };
        return updated;
      }
      return [...prev, { ...data, status: data.seeding ? 'seeding' : 'downloading', name: data.name || `Task (${data.id.substring(0, 8)})` }];
    });
  };

  const removeDownload = (id: string) => {
    setActiveDownloads(prev => prev.filter(d => d.id !== id));
  };

  return { dlLogs, addLog, activeDownloads, setActiveDownloads, updateDownload, removeDownload, downloadedFiles, setDownloadedFiles };
}
