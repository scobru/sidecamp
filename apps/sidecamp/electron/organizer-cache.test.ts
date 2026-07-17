// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { _setCacheFile, cacheGet, cachePut, cacheClear } from '../electron/organizer-cache';

let tmp: string;
let cacheFile: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sidecamp-cache-'));
  cacheFile = path.join(tmp, 'cache.json');
  _setCacheFile(cacheFile);
});

afterEach(async () => {
  await fs.remove(tmp);
});

describe('organizer-cache', () => {
  it('returns null on miss', async () => {
    const r = await cacheGet('/nope', 0);
    expect(r).toBeNull();
  });

  it('returns cached tracks on mtime match', async () => {
    const tracks = [{ name: 'a.mp3', artist: 'A', title: 'T' }];
    await cachePut('/some/dir', 12345, tracks);
    const r = await cacheGet('/some/dir', 12345);
    expect(r).toEqual(tracks);
  });

  it('returns null on mtime change (files added/removed)', async () => {
    await cachePut('/some/dir', 12345, [{ name: 'a.mp3' }]);
    const r = await cacheGet('/some/dir', 99999);
    expect(r).toBeNull();
  });

  it('returns null after TTL expires', async () => {
    await cachePut('/some/dir', 12345, [{ name: 'a.mp3' }]);
    // ponytail: rewrite scannedAt to 25h ago
    const data = await fs.readJson(cacheFile);
    data['/some/dir'].scannedAt = Date.now() - (25 * 60 * 60 * 1000);
    await fs.writeJson(cacheFile, data);
    const r = await cacheGet('/some/dir', 12345);
    expect(r).toBeNull();
  });

  it('clear removes cache file', async () => {
    await cachePut('/some/dir', 12345, [{ name: 'a.mp3' }]);
    expect(await fs.pathExists(cacheFile)).toBe(true);
    await cacheClear();
    expect(await fs.pathExists(cacheFile)).toBe(false);
  });

  it('serializes concurrent writes', async () => {
    // ponytail: simulate parallel cachePut — file stays valid JSON and contains all keys
    const writes = Array.from({ length: 4 }, (_, i) => cachePut(`/d${i}`, 1, [{ i }]));
    await Promise.all(writes);
    await new Promise(r => setTimeout(r, 50)); // let writeQueue drain
    const data = await fs.readJson(cacheFile);
    expect(Object.keys(data).length).toBe(4);
  });
});
