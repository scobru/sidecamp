import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { TorrentService, CANCELLED } from './torrent';

/**
 * A torrent that never finishes on its own, so every settle in these tests is
 * one the service produced — WebTorrent fires neither 'done' nor 'error' when
 * a transfer is removed, which is the whole reason cancellation needs handling.
 */
class FakeTorrent extends EventEmitter {
    infoHash = 'abc123';
    name = 'Fake Album';
    magnetURI = 'magnet:?xt=urn:btih:abc123';
    progress = 0;
    downloadSpeed = 0;
    uploadSpeed = 0;
    downloaded = 0;
    length = 100;
    done = false;
    files = [{ path: 'track.mp3' }];
}

let torrents: FakeTorrent[] = [];
let addImmediately = true;

const fakeClient = {
    add: vi.fn((_magnet: string, _opts: any, cb: (t: FakeTorrent) => void) => {
        const t = new FakeTorrent();
        torrents.push(t);
        // Metadata arrival is asynchronous in reality; `addImmediately: false`
        // models a cancel that lands before the infoHash exists.
        if (addImmediately) cb(t);
    }),
    get: vi.fn(async (infoHash: string) =>
        torrents.find((t) => t.infoHash === infoHash) ?? null,
    ),
    remove: vi.fn(async () => {}),
    destroy: vi.fn(),
    on: vi.fn(),
};

// A plain function, not an arrow: the service calls `new WebTorrentClass(...)`.
vi.mock('webtorrent', () => ({
    default: vi.fn(function () {
        return fakeClient;
    }),
}));

describe('TorrentService cancellation', () => {
    beforeEach(() => {
        torrents = [];
        addImmediately = true;
        vi.clearAllMocks();
    });

    it('settles a download cancelled by infoHash', async () => {
        const svc = new TorrentService('/downloads');
        const pending = svc.download('magnet:?xt=urn:btih:abc123', 'dl-1');
        // Let add()'s callback register the infoHash.
        await new Promise((r) => setTimeout(r, 0));

        await svc.remove('abc123');

        await expect(pending).rejects.toThrow(CANCELLED);
        expect(fakeClient.remove).toHaveBeenCalledWith('abc123', {
            destroyStore: false,
        });
    });

    it('discards the partial data only when asked', async () => {
        const svc = new TorrentService('/downloads');
        const pending = svc.download('magnet:?xt=urn:btih:abc123', 'dl-1');
        await new Promise((r) => setTimeout(r, 0));

        await svc.remove('dl-1', true);

        await expect(pending).rejects.toThrow(CANCELLED);
        expect(fakeClient.remove).toHaveBeenCalledWith('abc123', {
            destroyStore: true,
        });
    });

    it('does not delete files when seeding is stopped', async () => {
        // The regression that matters: Stop Seeding and Cancel share remove(),
        // and a completed torrent's files are the user's download.
        const svc = new TorrentService('/downloads');
        const pending = svc.download('magnet:?xt=urn:btih:abc123', 'dl-1');
        await new Promise((r) => setTimeout(r, 0));
        torrents[0].done = true;
        torrents[0].emit('done');
        await pending;

        await svc.remove('abc123');

        expect(fakeClient.remove).toHaveBeenCalledWith('abc123', {
            destroyStore: false,
        });
    });

    it('settles a download cancelled by downloadId', async () => {
        const svc = new TorrentService('/downloads');
        const pending = svc.download('magnet:?xt=urn:btih:abc123', 'dl-1');
        await new Promise((r) => setTimeout(r, 0));

        await svc.remove('dl-1');

        await expect(pending).rejects.toThrow(CANCELLED);
        // Resolved through the downloadId, so the torrent itself still went.
        expect(fakeClient.remove).toHaveBeenCalledWith('abc123', {
            destroyStore: false,
        });
    });

    it('settles a download cancelled before its metadata arrived', async () => {
        addImmediately = false;
        const svc = new TorrentService('/downloads');
        const pending = svc.download('magnet:?xt=urn:btih:abc123', 'dl-1');
        await new Promise((r) => setTimeout(r, 0));

        // No infoHash exists yet; only the downloadId can target this.
        await svc.remove('dl-1');

        await expect(pending).rejects.toThrow(CANCELLED);
    });

    it('leaves a finished download alone when its seeding is stopped', async () => {
        const svc = new TorrentService('/downloads');
        const pending = svc.download('magnet:?xt=urn:btih:abc123', 'dl-1');
        await new Promise((r) => setTimeout(r, 0));

        const t = torrents[0];
        t.done = true;
        t.progress = 1;
        t.emit('done');
        await expect(pending).resolves.toHaveLength(1);

        // Stop Seeding after completion must not reject an already-resolved
        // download, and must still remove the torrent.
        await expect(svc.remove('abc123')).resolves.toBeUndefined();
        expect(fakeClient.remove).toHaveBeenCalledWith('abc123', {
            destroyStore: false,
        });
    });

    it('ignores a removal with no usable identifier', async () => {
        const svc = new TorrentService('/downloads');
        await svc.remove('undefined');
        expect(fakeClient.remove).not.toHaveBeenCalled();
    });
});
