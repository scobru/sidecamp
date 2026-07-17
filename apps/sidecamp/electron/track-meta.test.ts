// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { _setCacheFile, getTracksMeta, setCachedAnalysis } from '../electron/track-meta';

let tmp: string;
let cacheFile: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sidecamp-meta-'));
  cacheFile = path.join(tmp, 'meta-cache.json');
  _setCacheFile(cacheFile);
});

afterEach(async () => {
  await fs.remove(tmp);
});

describe('track-meta', () => {
  it('falls back to "Artist - Title" filename parse on unreadable tags', async () => {
    const f = path.join(tmp, 'Bluvertigo - Altre Forme Di Vita.mp3');
    await fs.writeFile(f, 'not really an mp3');
    const metas = await getTracksMeta([f]);
    expect(metas[f].artist).toBe('Bluvertigo');
    expect(metas[f].title).toBe('Altre Forme Di Vita');
    expect(metas[f].bpm).toBeNull();
  });

  it('skips vanished files without throwing', async () => {
    const metas = await getTracksMeta([path.join(tmp, 'gone.mp3')]);
    expect(metas).toEqual({});
  });

  it('setCachedAnalysis upserts bpm+peaks and survives a re-read', async () => {
    const f = path.join(tmp, 'DJ Test - Loop.mp3');
    await fs.writeFile(f, 'x');
    await getTracksMeta([f]);
    await setCachedAnalysis(f, { bpm: 128.5012, peaks: [0, 50.4, 100, 120, -3] });
    const metas = await getTracksMeta([f]); // must hit cache, not re-parse
    expect(metas[f].bpm).toBe(128.5);
    expect(metas[f].peaks).toEqual([0, 50, 100, 100, 0]); // rounded + clamped 0-100
    expect(metas[f].artist).toBe('DJ Test');
  });

  it('setCachedAnalysis with only peaks keeps existing bpm', async () => {
    const f = path.join(tmp, 'DJ Test - Loop2.mp3');
    await fs.writeFile(f, 'x');
    await setCachedAnalysis(f, { bpm: 140 });
    await setCachedAnalysis(f, { peaks: [1, 2, 3] });
    const metas = await getTracksMeta([f]);
    expect(metas[f].bpm).toBe(140);
    expect(metas[f].peaks).toEqual([1, 2, 3]);
    await new Promise(r => setTimeout(r, 50)); // let writeQueue drain before afterEach removes tmp
  });

  it('setCachedAnalysis on a vanished file is a no-op', async () => {
    await expect(setCachedAnalysis(path.join(tmp, 'gone.mp3'), { bpm: 120 })).resolves.toBeUndefined();
  });

  it('persists to cache and serves hits on unchanged mtime', async () => {
    const f = path.join(tmp, '01 - Homologo - Gollum.mp3');
    await fs.writeFile(f, 'x');
    const first = await getTracksMeta([f]);
    expect(first[f].title).toBe('Gollum');
    await new Promise(r => setTimeout(r, 50)); // let writeQueue drain
    const data = await fs.readJson(cacheFile);
    expect(data[f].meta.artist).toBe('Homologo');
    const second = await getTracksMeta([f]);
    expect(second[f]).toEqual(first[f]);
  });
});
