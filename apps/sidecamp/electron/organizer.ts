import path from 'path';
import fs from 'fs-extra';
import { parseFile } from 'music-metadata';

export const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.aiff']);

export interface Track {
  path: string;
  size: number;
  ext: string;
  artist: string;
  title: string;
  album: string;
  genre: string;
  lossless: boolean;
  bitrate: number;
  /** true when artist/title came from the filename, not real tags */
  inferred: boolean;
}

export type OrganizeMode = 'artist' | 'artist-album' | 'genre';

export interface Action {
  type: 'move' | 'duplicate';
  from: string;
  to: string;
}

export interface Plan {
  actions: Action[];
  stats: { total: number; toMove: number; duplicates: number; alreadyOk: number; untagged: number };
}

const DUPES_DIR = '_duplicates';

function sanitize(part: string): string {
  return part.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '') || 'Unknown';
}

/** "Artist - Title" from filename, fallback when tags are empty */
function parseFilename(file: string): { artist: string; title: string } {
  const base = path.basename(file, path.extname(file))
    .replace(/^\d{1,3}[\s._-]+(?=\D)/, '') // strip leading track number
    .trim();
  const m = base.match(/^(.+?)\s*-\s*(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: '', title: base };
}

async function scanOne(full: string): Promise<Track | null> {
  try {
    const stat = await fs.stat(full);
    let artist = '', title = '', album = '', genre = '', lossless = false, bitrate = 0;
    try {
      const meta = await parseFile(full, { duration: false, skipCovers: true });
      artist = meta.common.artist?.trim() || '';
      title = meta.common.title?.trim() || '';
      album = meta.common.album?.trim() || '';
      genre = meta.common.genre?.[0]?.trim() || '';
      lossless = !!meta.format.lossless;
      bitrate = meta.format.bitrate || 0;
    } catch { /* unreadable tags → filename fallback below */ }
    let inferred = false;
    if (!artist || !title) {
      const fromName = parseFilename(full);
      artist = artist || fromName.artist;
      title = title || fromName.title;
      inferred = true;
    }
    return { path: full, size: stat.size, ext: path.extname(full).toLowerCase(), artist, title, album, genre, lossless, bitrate, inferred };
  } catch { return null; }
}

export async function scanDir(dir: string): Promise<Track[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  const candidates: string[] = [];
  for (const e of entries) {
    if (!e.isFile() || !AUDIO_EXTS.has(path.extname(e.name).toLowerCase())) continue;
    const full = path.join(e.parentPath ?? (e as any).path, e.name);
    // skip files we already parked as duplicates
    if (full.includes(path.sep + DUPES_DIR + path.sep)) continue;
    candidates.push(full);
  }

  const CONCURRENCY = 8;
  const tracks: Track[] = [];
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = await Promise.all(candidates.slice(i, i + CONCURRENCY).map(scanOne));
    for (const t of batch) if (t) tracks.push(t);
  }
  return tracks;
}

function dedupeKey(t: Track): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return norm(t.artist) + '|' + norm(t.title);
}

/** higher = better copy to keep */
function quality(t: Track): number {
  return (t.lossless ? 1e9 : 0) + t.bitrate * 1000 + t.size / 1e6;
}

export function buildPlan(tracks: Track[], root: string, mode: OrganizeMode): Plan {
  const actions: Action[] = [];
  let duplicates = 0, alreadyOk = 0, untagged = 0;

  // group by normalized artist+title; best copy stays, rest → _duplicates/
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    const key = dedupeKey(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const taken = new Set<string>();
  const uniqueTarget = (p: string): string => {
    let candidate = p;
    for (let i = 2; taken.has(candidate.toLowerCase()); i++) {
      const ext = path.extname(p);
      candidate = p.slice(0, -ext.length) + ` (${i})` + ext;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  };

  for (const group of groups.values()) {
    group.sort((a, b) => quality(b) - quality(a));
    const [keeper, ...dupes] = group;

    if (!keeper.artist) untagged++;
    const artist = sanitize(keeper.artist || 'Unknown Artist');
    const title = sanitize(keeper.title || path.basename(keeper.path, path.extname(keeper.path)));
    const fileName = `${artist} - ${title}${keeper.ext}`;
    const destDir =
      mode === 'genre' ? path.join(root, sanitize(keeper.genre || 'Unknown Genre')) :
      mode === 'artist-album' && keeper.album ? path.join(root, artist, sanitize(keeper.album)) :
      path.join(root, artist);
    const target = uniqueTarget(path.join(destDir, fileName));

    if (path.resolve(target) === path.resolve(keeper.path)) alreadyOk++;
    else actions.push({ type: 'move', from: keeper.path, to: target });

    for (const d of dupes) {
      duplicates++;
      actions.push({ type: 'duplicate', from: d.path, to: uniqueTarget(path.join(root, DUPES_DIR, path.basename(d.path))) });
    }
  }

  return { actions, stats: { total: tracks.length, toMove: actions.length - duplicates, duplicates, alreadyOk, untagged } };
}

export async function applyPlan(root: string, actions: Action[]): Promise<{ done: number; errors: string[] }> {
  const r = path.resolve(root);
  const inside = (p: string) => { const x = path.resolve(p); return x === r || x.startsWith(r + path.sep); };
  let done = 0;
  const errors: string[] = [];
  for (const a of actions) {
    try {
      if (!inside(a.from) || !inside(a.to)) throw new Error('path outside selected folder');
      await fs.move(a.from, a.to, { overwrite: false });
      done++;
    } catch (err: any) {
      errors.push(`${path.basename(a.from)}: ${err.message}`);
    }
  }
  // sweep now-empty dirs left behind by moves
  await removeEmptyDirs(r, r).catch(() => {});
  return { done, errors };
}

async function removeEmptyDirs(dir: string, root: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let empty = true;
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!(await removeEmptyDirs(path.join(dir, e.name), root))) empty = false;
    } else empty = false;
  }
  if (empty && dir !== root) { await fs.rmdir(dir); return true; }
  return empty;
}
