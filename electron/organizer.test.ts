import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { buildPlan, scanDir, applyPlan, Track } from './organizer';

const ROOT = path.resolve('/music');

function track(over: Partial<Track>): Track {
  return {
    path: path.join(ROOT, 'file.mp3'), size: 1000, ext: '.mp3',
    artist: '', title: '', album: '', genre: '',
    lossless: false, bitrate: 320000, inferred: false,
    ...over,
  };
}

describe('buildPlan', () => {
  it('moves track to Artist/Artist - Title', () => {
    const t = track({ path: path.join(ROOT, 'random.mp3'), artist: 'Daft Punk', title: 'Around the World' });
    const plan = buildPlan([t], ROOT, 'artist');
    expect(plan.actions).toEqual([{ type: 'move', from: t.path, to: path.join(ROOT, 'Daft Punk', 'Daft Punk - Around the World.mp3') }]);
  });

  it('skips files already in place', () => {
    const t = track({ path: path.join(ROOT, 'Daft Punk', 'Daft Punk - Around the World.mp3'), artist: 'Daft Punk', title: 'Around the World' });
    const plan = buildPlan([t], ROOT, 'artist');
    expect(plan.actions).toHaveLength(0);
    expect(plan.stats.alreadyOk).toBe(1);
  });

  it('keeps best quality copy, sends rest to _duplicates', () => {
    const flac = track({ path: path.join(ROOT, 'a.flac'), ext: '.flac', artist: 'X', title: 'Y', lossless: true });
    const mp3 = track({ path: path.join(ROOT, 'b.mp3'), artist: 'X', title: 'Y' });
    const plan = buildPlan([mp3, flac], ROOT, 'artist');
    const dup = plan.actions.find(a => a.type === 'duplicate');
    expect(dup?.from).toBe(mp3.path);
    expect(dup?.to).toBe(path.join(ROOT, '_duplicates', 'b.mp3'));
    expect(plan.actions.find(a => a.type === 'move')?.from).toBe(flac.path);
  });

  it('dedupes on normalized artist+title (case/punctuation-insensitive)', () => {
    const a = track({ path: path.join(ROOT, 'a.mp3'), artist: 'Daft Punk', title: "One More Time" });
    const b = track({ path: path.join(ROOT, 'b.mp3'), artist: 'daft punk', title: 'one-more-time', size: 500 });
    const plan = buildPlan([a, b], ROOT, 'artist');
    expect(plan.stats.duplicates).toBe(1);
  });

  it('sanitizes illegal filename characters', () => {
    const t = track({ path: path.join(ROOT, 'x.mp3'), artist: 'AC/DC', title: 'What: is <this>?' });
    const plan = buildPlan([t], ROOT, 'artist');
    expect(plan.actions[0].to).toBe(path.join(ROOT, 'ACDC', 'ACDC - What is this.mp3'));
  });

  it('genre mode groups by genre with Unknown fallback', () => {
    const a = track({ path: path.join(ROOT, 'a.mp3'), artist: 'X', title: 'A', genre: 'Techno' });
    const b = track({ path: path.join(ROOT, 'b.mp3'), artist: 'X', title: 'B' });
    const plan = buildPlan([a, b], ROOT, 'genre');
    expect(plan.actions.map(x => x.to).sort()).toEqual([
      path.join(ROOT, 'Techno', 'X - A.mp3'),
      path.join(ROOT, 'Unknown Genre', 'X - B.mp3'),
    ].sort());
  });

  it('avoids target collisions with (2) suffix', () => {
    const a = track({ path: path.join(ROOT, 'a.mp3'), artist: 'X', title: 'Song' });
    const b = track({ path: path.join(ROOT, 'b.mp3'), artist: 'X', title: 'Song!' }); // same dedupe key? no: "song" vs "song" — punctuation stripped, same key → dup
    const c = track({ path: path.join(ROOT, 'c.mp3'), artist: 'X', title: 'Söng' }); // different key, same sanitized name? 'Söng' keeps ö → different file name
    const plan = buildPlan([a, b, c], ROOT, 'artist');
    const targets = plan.actions.map(x => x.to.toLowerCase());
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('album mode nests under Artist/Album', () => {
    const t = track({ path: path.join(ROOT, 'x.mp3'), artist: 'X', title: 'A', album: 'Discovery' });
    const plan = buildPlan([t], ROOT, 'artist-album');
    expect(plan.actions[0].to).toBe(path.join(ROOT, 'X', 'Discovery', 'X - A.mp3'));
  });
});

describe('scan → plan → apply (integration)', () => {
  it('organizes untagged files by filename and cleans empty dirs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'organizer-'));
    try {
      // not real mp3s → tag parsing fails → filename fallback path exercised
      await fs.outputFile(path.join(root, 'sub', '01 - Aphex Twin - Xtal.mp3'), 'x');
      await fs.outputFile(path.join(root, 'Boards of Canada - Roygbiv.mp3'), 'y');
      await fs.outputFile(path.join(root, 'notes.txt'), 'skip me');

      const tracks = await scanDir(root);
      expect(tracks).toHaveLength(2);

      const plan = buildPlan(tracks, root, 'artist');
      const result = await applyPlan(root, plan.actions);
      expect(result.errors).toEqual([]);
      expect(result.done).toBe(2);

      expect(await fs.pathExists(path.join(root, 'Aphex Twin', 'Aphex Twin - Xtal.mp3'))).toBe(true);
      expect(await fs.pathExists(path.join(root, 'Boards of Canada', 'Boards of Canada - Roygbiv.mp3'))).toBe(true);
      expect(await fs.pathExists(path.join(root, 'sub'))).toBe(false); // empty dir swept
      expect(await fs.pathExists(path.join(root, 'notes.txt'))).toBe(true); // non-audio untouched
    } finally {
      await fs.remove(root);
    }
  });

  it('rejects actions escaping the root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'organizer-'));
    try {
      await fs.outputFile(path.join(root, 'a.mp3'), 'x');
      const result = await applyPlan(root, [{ type: 'move', from: path.join(root, 'a.mp3'), to: path.join(root, '..', 'escaped.mp3') }]);
      expect(result.done).toBe(0);
      expect(result.errors).toHaveLength(1);
    } finally {
      await fs.remove(root);
    }
  });
});
