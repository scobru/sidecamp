/// <reference types="vite/client" />

declare module 'tunecamp-design-system';

interface Window {
  electronAPI: {
    importFolder: () => Promise<import('./components/LibraryPanel').LibTrack[]>;
    loadLibrary: () => Promise<import('./components/LibraryPanel').LibTrack[]>;
    clearLibrary: () => Promise<import('./components/LibraryPanel').LibTrack[]>;
    saveGraph: (data: any) => Promise<void>;
    loadGraph: () => Promise<any>;
    readAudioFile: (path: string) => Promise<Uint8Array>;
    updateTrackMeta: (path: string, data: any) => Promise<void>;
    saveRecording: (filename: string, buffer: Uint8Array) => Promise<boolean>;
    checkForUpdate: () => Promise<{ currentVersion: string; latestVersion: string | null; updateAvailable: boolean }>;
    openReleasesPage: () => Promise<void>;
  };
}
