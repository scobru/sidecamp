import { dialog, app } from 'electron';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { parseFile } from 'music-metadata';

export type LibTrack = {
  path: string;
  name: string;
  bpm: number | null;
  key: string;
  genre: string;
  artist?: string;
  title?: string;
  duration?: number;
  peaks?: number[];
  beatOffset?: number | null;
};

const CACHE_FILE = path.join(app.getPath('userData'), 'graphofone-library.json');
const GRAPH_FILE = path.join(app.getPath('userData'), 'graphofone-set.json');

let libraryCache: LibTrack[] = [];

// Load the library from disk
export async function loadLibrary(): Promise<LibTrack[]> {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = await fs.readFile(CACHE_FILE, 'utf-8');
      libraryCache = JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load library cache', err);
  }
  return libraryCache;
}

// Save the library to disk
export async function saveLibrary() {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(libraryCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save library cache', err);
  }
}

// Recursively find audio files
async function findAudioFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  const exts = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aiff']);
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await findAudioFiles(fullPath, fileList);
        } else if (exts.has(path.extname(fullPath).toLowerCase())) {
          fileList.push(fullPath);
        }
      } catch (e) {
        // ignore permission errors on individual files
      }
    }
  } catch (e) {
    // ignore unreadable dirs
  }
  return fileList;
}

// Convert common keys to Camelot
const CLASSIC_TO_CAMELOT: Record<string, string> = {
  'c': '8B', 'am': '8A', 'g': '9B', 'em': '9A', 'd': '10B', 'bm': '10A',
  'a': '11B', 'f#m': '11A', 'e': '12B', 'c#m': '12A', 'b': '1B', 'g#m': '1A',
  'f#': '2B', 'd#m': '2A', 'c#': '3B', 'a#m': '3A', 'g#': '4B', 'fm': '4A',
  'd#': '5B', 'cm': '5A', 'a#': '6B', 'gm': '6A', 'f': '7B', 'dm': '7A'
};

function normalizeKey(k: string | undefined): string {
  if (!k) return '';
  k = k.trim().toLowerCase();
  if (k.match(/^\d{1,2}[ab]$/i)) return k.toUpperCase();
  k = k.replace(/\s*(maj|major)$/, '').replace(/\s*(min|minor)$/, 'm');
  return CLASSIC_TO_CAMELOT[k] || k.toUpperCase();
}

// Import a folder and scan metadata
export async function importFolder(): Promise<LibTrack[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Music Folder',
    properties: ['openDirectory', 'multiSelections']
  });

  if (canceled || filePaths.length === 0) return libraryCache;

  const newFiles: string[] = [];
  for (const dir of filePaths) {
    await findAudioFiles(dir, newFiles);
  }

  // Filter out files already in library
  const existingPaths = new Set(libraryCache.map(t => t.path));
  const toScan = newFiles.filter(p => !existingPaths.has(p));

  const newTracks: LibTrack[] = [];
  for (const file of toScan) {
    try {
      const meta = await parseFile(file, { duration: true, skipCovers: true });
      const tags = meta.common;
      newTracks.push({
        path: file,
        name: path.basename(file),
        bpm: tags.bpm ? Math.round(tags.bpm) : null,
        key: normalizeKey(tags.key),
        genre: tags.genre?.[0] || '',
        artist: tags.artist,
        title: tags.title,
        duration: meta.format.duration
      });
    } catch (err) {
      console.warn(`Failed to parse metadata for ${file}`, err);
      // Still add it without metadata
      newTracks.push({
        path: file,
        name: path.basename(file),
        bpm: null,
        key: '',
        genre: ''
      });
    }
  }

  if (newTracks.length > 0) {
    libraryCache = [...libraryCache, ...newTracks];
    await saveLibrary();
  }

  return libraryCache;
}

export async function clearLibrary(): Promise<LibTrack[]> {
  libraryCache = [];
  await saveLibrary();
  return libraryCache;
}

// Graph Set persistence
export async function saveGraph(graphData: any) {
  try {
    await fs.writeFile(GRAPH_FILE, JSON.stringify(graphData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save graph set', err);
  }
}

export async function loadGraph(): Promise<any> {
  try {
    if (existsSync(GRAPH_FILE)) {
      const data = await fs.readFile(GRAPH_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load graph set', err);
  }
  return null;
}

// Offline analysis helpers
export async function readAudioFile(filePath: string): Promise<Uint8Array> {
  const buf = await fs.readFile(filePath);
  return new Uint8Array(buf);
}

export async function updateTrackMeta(filePath: string, data: Partial<LibTrack>) {
  const idx = libraryCache.findIndex(t => t.path === filePath);
  if (idx !== -1) {
    libraryCache[idx] = { ...libraryCache[idx], ...data };
    await saveLibrary();
  }
}

// Apply many metadata updates in memory and persist once (avoids O(n) disk
// writes per track when analyzing a whole library).
export async function updateTrackMetaBatch(updates: { path: string; data: Partial<LibTrack> }[]): Promise<LibTrack[]> {
  const byPath = new Map(updates.map(u => [u.path, u.data]));
  libraryCache = libraryCache.map(t => byPath.has(t.path) ? { ...t, ...byPath.get(t.path) } : t);
  await saveLibrary();
  return libraryCache;
}
