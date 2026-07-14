import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { app } from 'electron';
import { parseFile } from 'music-metadata';

// Per-file tag metadata for the Library table (rekordbox-style columns).
// Cached on disk keyed by path+mtime so a library rescan is instant.

export interface TrackMeta {
  title: string;
  artist: string;
  album: string;
  genre: string;
  bpm: number | null;
  key: string;
  duration: number; // seconds
  year: number | null;
  bitrate: number;  // bps
  /** waveform peaks 0-100, computed by the renderer's Analyze pass (not derivable from tags) */
  peaks?: number[];
  /** beat phase in seconds (first-beat offset modulo beat period), from the Analyze pass */
  beatOffset?: number;
}

interface CacheEntry { mtime: number; meta: TrackMeta; }

let cacheFile: string | null = null;
let cache: Record<string, CacheEntry> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getCacheFile(): string {
  if (cacheFile) return cacheFile;
  // ponytail: app.getPath may be undefined in test env → fall back to tmp
  try {
    cacheFile = path.join(app.getPath('userData'), 'track-meta-cache.json');
  } catch {
    cacheFile = path.join(os.tmpdir(), 'sidecamp-track-meta-cache.json');
  }
  return cacheFile;
}

// override for tests
export function _setCacheFile(p: string) { cacheFile = p; cache = null; }

async function loadCache(): Promise<Record<string, CacheEntry>> {
  if (cache) return cache;
  try {
    cache = ((await fs.pathExists(getCacheFile())) ? await fs.readJson(getCacheFile()) : {}) || {};
  } catch { cache = {}; }
  return cache!;
}

function persistCache() {
  // serialize writes so concurrent batches don't race the JSON file;
  // snapshot file+data now so a later _setCacheFile can't redirect a queued write
  const file = getCacheFile();
  const snap = cache;
  writeQueue = writeQueue.then(async () => {
    await fs.ensureDir(path.dirname(file));
    await fs.writeJson(file, snap, { spaces: 0 });
  }).catch(() => {});
}

/** "Artist - Title" from filename, fallback when tags are empty */
function fromFilename(file: string): { artist: string; title: string } {
  const base = path.basename(file, path.extname(file)).replace(/^\d{1,3}[\s._-]+(?=\D)/, '').trim();
  const m = base.match(/^(.+?)\s*-\s*(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: base };
}

async function parseOne(filePath: string): Promise<TrackMeta> {
  let meta: TrackMeta = { title: '', artist: '', album: '', genre: '', bpm: null, key: '', duration: 0, year: null, bitrate: 0 };
  try {
    const m = await parseFile(filePath, { duration: true, skipCovers: true });
    meta = {
      title: m.common.title?.trim() || '',
      artist: m.common.artist?.trim() || '',
      album: m.common.album?.trim() || '',
      genre: m.common.genre?.[0]?.trim() || '',
      bpm: m.common.bpm ? Math.round(m.common.bpm * 100) / 100 : null,
      key: (m.common.key || '').trim(),
      duration: m.format.duration ? Math.round(m.format.duration) : 0,
      year: m.common.year || null,
      bitrate: m.format.bitrate ? Math.round(m.format.bitrate) : 0,
    };
  } catch { /* unreadable tags → filename fallback below */ }
  if (!meta.title || !meta.artist) {
    const fn = fromFilename(filePath);
    meta.title = meta.title || fn.title;
    meta.artist = meta.artist || fn.artist;
  }
  return meta;
}

/** Upsert analysis results (BPM and/or waveform peaks) into the cache.
 *  Stats the file AFTER any tag write so the stored mtime matches the on-disk state. */
export async function setCachedAnalysis(filePath: string, data: { bpm?: number; peaks?: number[]; beatOffset?: number }): Promise<void> {
  const c = await loadCache();
  let st;
  try { st = await fs.stat(filePath); } catch { return; }
  const meta = c[filePath]?.meta ?? await parseOne(filePath);
  if (typeof data.bpm === 'number' && Number.isFinite(data.bpm)) meta.bpm = Math.round(data.bpm * 100) / 100;
  if (Array.isArray(data.peaks) && data.peaks.length > 0 && data.peaks.length <= 400) {
    meta.peaks = data.peaks.map(p => Math.max(0, Math.min(100, Math.round(Number(p) || 0))));
  }
  if (typeof data.beatOffset === 'number' && Number.isFinite(data.beatOffset) && data.beatOffset >= 0 && data.beatOffset < 3) {
    meta.beatOffset = Math.round(data.beatOffset * 10000) / 10000;
  }
  c[filePath] = { mtime: st.mtimeMs, meta };
  persistCache();
}

/** Batch-resolve metadata for a list of files. Cache hit = free, miss = parse (bounded concurrency). */
export async function getTracksMeta(paths: string[]): Promise<Record<string, TrackMeta>> {
  const c = await loadCache();
  const out: Record<string, TrackMeta> = {};
  const misses: { p: string; mtime: number }[] = [];

  for (const p of paths) {
    try {
      const st = await fs.stat(p);
      const hit = c[p];
      if (hit && hit.mtime === st.mtimeMs) out[p] = hit.meta;
      else misses.push({ p, mtime: st.mtimeMs });
    } catch { /* file vanished — skip */ }
  }

  const CONCURRENCY = 8;
  for (let i = 0; i < misses.length; i += CONCURRENCY) {
    await Promise.all(misses.slice(i, i + CONCURRENCY).map(async ({ p, mtime }) => {
      const meta = await parseOne(p);
      c[p] = { mtime, meta };
      out[p] = meta;
    }));
  }
  if (misses.length > 0) persistCache();
  return out;
}
