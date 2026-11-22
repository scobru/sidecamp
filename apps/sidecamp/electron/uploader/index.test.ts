import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
    FAST_HASH_THRESHOLD,
    getFileHash,
    getFastFileHash,
    TuneCampUploader,
} from './index';

describe('TuneCampUploader & file hashing', () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sidecamp-uploader-'));
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });

    it('computes full MD5 for files smaller than 2 MiB', async () => {
        const filePath = path.join(tmpDir, 'small.mp3');
        const content = Buffer.from('hello tunecamp audio payload');
        await fs.promises.writeFile(filePath, content);

        const expected = crypto.createHash('md5').update(content).digest('hex');
        expect(await getFileHash(filePath)).toBe(expected);
        expect(await getFastFileHash(filePath)).toBe(expected);
    });

    it('computes fast MD5 (head 1 MiB + tail 1 MiB + size) at and above 2 MiB', async () => {
        const boundaryPath = path.join(tmpDir, 'boundary.flac');
        const boundaryBuf = Buffer.alloc(FAST_HASH_THRESHOLD);
        boundaryBuf.fill(0x11, 0, 1024 * 1024);
        boundaryBuf.fill(0x22, 1024 * 1024, FAST_HASH_THRESHOLD);
        await fs.promises.writeFile(boundaryPath, boundaryBuf);

        const expectedBoundary = crypto
            .createHash('md5')
            .update(boundaryBuf.subarray(0, 1024 * 1024))
            .update(boundaryBuf.subarray(FAST_HASH_THRESHOLD - 1024 * 1024))
            .update(FAST_HASH_THRESHOLD.toString())
            .digest('hex');
        expect(await getFastFileHash(boundaryPath)).toBe(expectedBoundary);

        const largeA = path.join(tmpDir, 'large-a.wav');
        const largeB = path.join(tmpDir, 'large-b.wav');
        const size = 2 * 1024 * 1024 + 4096;
        const bufA = Buffer.alloc(size, 0xaa);
        const bufB = Buffer.alloc(size, 0xaa);
        // Differ only in the middle (outside first 1 MiB and last 1 MiB)
        bufB.fill(0x55, 1024 * 1024 + 512, 1024 * 1024 + 2048);

        await fs.promises.writeFile(largeA, bufA);
        await fs.promises.writeFile(largeB, bufB);

        const hashA = await getFastFileHash(largeA);
        const hashB = await getFastFileHash(largeB);
        expect(hashA).toBe(hashB);

        const expectedLarge = crypto
            .createHash('md5')
            .update(bufA.subarray(0, 1024 * 1024))
            .update(bufA.subarray(size - 1024 * 1024))
            .update(size.toString())
            .digest('hex');
        expect(hashA).toBe(expectedLarge);
    });

    it('detects duplicates via track.hash and track.file_hash, caches, dedupes inflight, and invalidates on config/refresh', async () => {
        const dupFileA = path.join(tmpDir, 'dup-a.mp3');
        const dupFileB = path.join(tmpDir, 'dup-b.mp3');
        const freshFile = path.join(tmpDir, 'fresh.mp3');
        await fs.promises.writeFile(dupFileA, Buffer.from('track-alpha'));
        await fs.promises.writeFile(dupFileB, Buffer.from('track-beta'));
        await fs.promises.writeFile(freshFile, Buffer.from('track-gamma'));

        const hashA = await getFastFileHash(dupFileA);
        const hashB = await getFastFileHash(dupFileB);

        const fetchMock = vi.fn().mockImplementation(async (url: string) => {
            expect(url).toBe('https://music.example.com/api/tracks');
            return {
                ok: true,
                json: async () => [
                    { id: 10, title: 'Alpha', artistName: 'Artist One', albumName: 'Album X', hash: hashA.toUpperCase() },
                    { id: 11, title: 'Beta', artist_name: 'Artist Two', file_hash: `  ${hashB}  ` },
                ],
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const uploader = new TuneCampUploader({ server: 'https://music.example.com/', token: 'tok-1' });

        // Concurrent calls should share a single in-flight fetch
        const [resA, resB] = await Promise.all([
            uploader.checkFileExists(dupFileA),
            uploader.checkFileExists(dupFileB),
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(resA.exists).toBe(true);
        expect(resA.match).toEqual({
            id: 10,
            title: 'Alpha',
            artist: 'Artist One',
            album: 'Album X',
            hash: hashA,
        });
        expect(resB.exists).toBe(true);
        expect(resB.match?.artist).toBe('Artist Two');

        // Cached check does not re-fetch; same config via setConfig preserves cache
        uploader.setConfig({ server: 'https://music.example.com', token: 'tok-1' });
        const batch = await uploader.checkFilesExist([dupFileA, freshFile, path.join(tmpDir, 'missing.mp3')]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(batch[dupFileA].exists).toBe(true);
        expect(batch[freshFile].exists).toBe(false);
        expect(Object.keys(batch)).toHaveLength(2);

        // refresh: true forces re-fetch
        await uploader.checkFileExists(freshFile, { refresh: true });
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // Changing token invalidates cache
        uploader.setConfig({ server: 'https://music.example.com', token: 'tok-2' });
        await uploader.checkFileExists(dupFileA);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('falls back to /api/tracks?mine=true when /api/tracks returns 5000+ rows', async () => {
        const myFile = path.join(tmpDir, 'mine.mp3');
        await fs.promises.writeFile(myFile, Buffer.from('my-private-track'));
        const myHash = await getFastFileHash(myFile);

        const bulkRows = Array.from({ length: 5000 }, (_, i) => ({
            id: i + 1,
            title: `Track ${i + 1}`,
            hash: `0000${i}`,
        }));

        const fetchMock = vi.fn().mockImplementation(async (url: string) => {
            if (url === 'https://music.example.com/api/tracks') {
                return { ok: true, json: async () => bulkRows };
            }
            if (url === 'https://music.example.com/api/tracks?mine=true') {
                return { ok: true, json: async () => [{ id: 9999, title: 'My Hidden Track', hash: myHash }] };
            }
            throw new Error(`Unexpected URL: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const uploader = new TuneCampUploader({ server: 'https://music.example.com', token: 'tok' });
        const res = await uploader.checkFileExists(myFile);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(res.exists).toBe(true);
        expect(res.match?.id).toBe(9999);
    });

    it('skips POST on duplicate uploadTrack, caches new uploads, and honors force: true', async () => {
        const existingFile = path.join(tmpDir, 'existing.mp3');
        const newFile = path.join(tmpDir, 'new.mp3');
        await fs.promises.writeFile(existingFile, Buffer.from('already-there'));
        await fs.promises.writeFile(newFile, Buffer.from('brand-new-track'));

        const existingHash = await getFastFileHash(existingFile);
        const newHash = await getFastFileHash(newFile);

        const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.endsWith('/api/tracks')) {
                return {
                    ok: true,
                    json: async () => [{ id: 42, title: 'Existing Track', artistName: 'Demo', hash: existingHash }],
                };
            }
            if (url.endsWith('/api/admin/upload/tracks') && init?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({ message: 'Uploaded 1 files.', results: [{ success: true, trackId: 43 }] }),
                };
            }
            throw new Error(`Unexpected fetch: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const uploader = new TuneCampUploader({ server: 'https://music.example.com', token: 'tok' });

        // 1. Existing file is skipped without POST
        const skipRes = await uploader.uploadTrack(existingFile, { title: 'Existing Track' });
        expect(skipRes.skipped).toBe(true);
        expect(skipRes.duplicate).toBe(true);
        expect(skipRes.hash).toBe(existingHash);
        expect(skipRes.existingTrack?.id).toBe(42);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // 2. New file uploads via POST
        const uploadRes = await uploader.uploadTrack(newFile, { title: 'New Track', artist: 'Me' });
        expect(uploadRes.skipped).toBe(false);
        expect(uploadRes.duplicate).toBe(false);
        expect(uploadRes.hash).toBe(newHash);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // 3. Re-uploading the new file is caught immediately from the updated hash cache
        const secondAttempt = await uploader.uploadTrack(newFile, { title: 'New Track', artist: 'Me' });
        expect(secondAttempt.skipped).toBe(true);
        expect(secondAttempt.duplicate).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // 4. force: true uploads anyway
        const forced = await uploader.uploadTrack(existingFile, { title: 'Existing Track', force: true });
        expect(forced.skipped).toBe(false);
        expect(forced.duplicate).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
