import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

// ponytail: cache file keyed by dir path + mtime. Re-scan only when mtime changes (files added/removed/renamed).
// TTL fallback: 24h, in case mtime check misfires (e.g. clock skew, FS weirdness).
const TTL_MS = 24 * 60 * 60 * 1000;

let cacheFile: string | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getCacheFile(): string {
  if (cacheFile) return cacheFile;
  // ponytail: app.getPath may be undefined in test env → fall back to tmp
  try {
    cacheFile = path.join(app.getPath('userData'), 'organize-cache.json');
  } catch {
    cacheFile = path.join(os.tmpdir(), 'sidecamp-organize-cache.json');
  }
  return cacheFile;
}

// override for tests
export function _setCacheFile(p: string) { cacheFile = p; }

interface CacheEntry {
  mtime: number;
  scannedAt: number;
  tracks: any[];
}

async function readAll(): Promise<Record<string, CacheEntry>> {
  try {
    const f = getCacheFile();
    if (!(await fs.pathExists(f))) return {};
    return await fs.readJson(f);
  } catch { return {}; }
}

export async function cacheGet(dir: string, dirMtime: number): Promise<any[] | null> {
  const all = await readAll();
  const entry = all[dir];
  if (!entry) return null;
  if (entry.mtime !== dirMtime) return null;
  if (Date.now() - entry.scannedAt > TTL_MS) return null;
  return entry.tracks;
}

export async function cachePut(dir: string, dirMtime: number, tracks: any[]): Promise<void> {
  const next = writeQueue.then(async () => {
    const all = await readAll();
    all[dir] = { mtime: dirMtime, scannedAt: Date.now(), tracks };
    await fs.ensureDir(path.dirname(getCacheFile()));
    await fs.writeJson(getCacheFile(), all, { spaces: 0 });
  });
  writeQueue = next.catch(() => {});
  return next;
}

export async function cacheClear(): Promise<void> {
  const f = getCacheFile();
  if (await fs.pathExists(f)) await fs.remove(f);
}
