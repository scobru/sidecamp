import type WebTorrent from 'webtorrent';
import { EventEmitter } from 'events';
import path from 'path';

/**
 * Rejection reason for a download the user stopped on purpose. The renderer
 * checks for it so a cancellation isn't reported as a failed transfer.
 */
export const CANCELLED = 'TORRENT_CANCELLED';

interface PendingDownload {
    /** Only known once metadata arrives, which is after `add()` returns. */
    infoHash?: string;
    /** Settles the in-flight `download()` promise. */
    cancel: () => void;
}

export class TorrentService extends EventEmitter {
    private client: WebTorrent.Instance | null = null;
    private downloadDir: string;
    private port: number;
    private seededFiles: Map<string, string> = new Map(); // filePath -> magnetURI
    /**
     * In-flight downloads, keyed by downloadId *and* by infoHash once known —
     * both entries point at the same object, so `remove()` can be called with
     * whichever identifier the caller happens to hold.
     */
    private pending: Map<string, PendingDownload> = new Map();

    constructor(downloadDir: string, port?: number) {
        super();
        this.downloadDir = downloadDir;
        this.port = port || 0;
    }

    private async ensureClient(): Promise<WebTorrent.Instance> {
        if (!this.client) {
            const WebTorrentClass = (await import('webtorrent')).default;
            this.client = new WebTorrentClass({ port: this.port, utp: false });
            this.client.on('error', (err: any) => {
                console.error("WebTorrent error:", err);
                this.emit('error', err);
            });
        }
        return this.client;
    }

    public getMagnetUriForFile(filePath: string): string | undefined {
        return this.seededFiles.get(filePath);
    }

    public async seed(input: string | string[], torrentName?: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            let client;
            try {
                client = await this.ensureClient();
            } catch (err) {
                return reject(err);
            }

            const name = torrentName || (typeof input === 'string' ? path.basename(input) : 'Album');
            this.emit('log', `Avvio seeding per il torrent: ${name}`);

            client.seed(input, { name }, (torrent) => {
                this.emit('log', `Seeding attivo: ${torrent.name}`);
                
                if (Array.isArray(input)) {
                    for (const filePath of input) {
                        this.seededFiles.set(filePath, torrent.magnetURI);
                    }
                } else {
                    this.seededFiles.set(input, torrent.magnetURI);
                }

                let lastEmit = 0;
                const emitProgress = (force = false) => {
                    const now = Date.now();
                    if (!force && now - lastEmit < 200) return;
                    lastEmit = now;
                    this.emit('progress', {
                        id: torrent.infoHash,
                        name: torrent.name,
                        progress: torrent.progress,
                        speed: torrent.downloadSpeed,
                        uploadSpeed: torrent.uploadSpeed,
                        downloaded: torrent.downloaded,
                        total: torrent.length,
                        seeding: true
                    });
                };

                torrent.on('upload', () => emitProgress());
                torrent.on('download', () => emitProgress());

                emitProgress(true);
                resolve(torrent.magnetURI);
            });
        });
    }

    public async download(magnetUri: string, downloadId?: string): Promise<string[]> {
        return new Promise(async (resolve, reject) => {
            let client;
            try {
                client = await this.ensureClient();
            } catch (err) {
                return reject(err);
            }
            this.emit('log', `Inizio download magnet...`);

            // WebTorrent's remove() fires neither 'done' nor 'error', so a
            // cancelled download would leave this promise — and the IPC call
            // awaiting it — pending forever. Registering a settle handle here
            // is what lets remove() end it.
            const keys: string[] = [];
            const forget = () => { for (const k of keys) this.pending.delete(k); };
            const entry: PendingDownload = {
                cancel: () => { forget(); reject(new Error(CANCELLED)); },
            };
            if (downloadId) {
                keys.push(downloadId);
                this.pending.set(downloadId, entry);
            }

            client.add(magnetUri, { path: this.downloadDir }, (torrent) => {
                this.emit('log', `Metadati ricevuti: ${torrent.name}`);

                // Metadata is the first point the infoHash exists; a cancel
                // before now can only arrive by downloadId.
                entry.infoHash = torrent.infoHash;
                keys.push(torrent.infoHash);
                this.pending.set(torrent.infoHash, entry);

                let lastEmit = 0;
                const emitProgress = (force = false) => {
                    const now = Date.now();
                    const isDone = torrent.done || torrent.progress >= 1;
                    if (!force && !isDone && now - lastEmit < 200) return;
                    lastEmit = now;
                    this.emit('progress', {
                        // downloadId correlates with the UI's active-download entry;
                        // infoHash is kept so the stop/seed control can target the torrent.
                        id: downloadId || torrent.infoHash,
                        infoHash: torrent.infoHash,
                        name: torrent.name,
                        progress: torrent.progress,
                        speed: torrent.downloadSpeed,
                        uploadSpeed: torrent.uploadSpeed,
                        downloaded: torrent.downloaded,
                        total: torrent.length,
                        seeding: torrent.done
                    });
                };

                torrent.on('download', () => emitProgress());
                torrent.on('upload', () => emitProgress());

                torrent.on('done', () => {
                    emitProgress(true);
                    this.emit('log', `Download completato e in seeding: ${torrent.name}`);
                    const files = torrent.files.map(f => path.join(this.downloadDir, f.path));
                    forget();
                    resolve(files);
                });

                torrent.on('error', (err) => {
                    forget();
                    reject(err);
                });
            });
        });
    }

    /**
     * Stop a torrent, whether it is seeding or still downloading. Accepts an
     * infoHash or the downloadId the transfer was started with — a download
     * cancelled before its metadata arrived has no infoHash yet.
     */
    public async remove(idOrInfoHash: string) {
        if (!idOrInfoHash || idOrInfoHash === 'undefined') {
            return;
        }
        const pending = this.pending.get(idOrInfoHash);
        const infoHash = pending?.infoHash ?? idOrInfoHash;
        if (this.client) {
            try {
                const torrent = await this.client.get(infoHash);
                if (torrent) {
                    this.emit('log', `Rimozione torrent e stop seeding per: ${torrent.name}`);
                    for (const [file, magnet] of this.seededFiles.entries()) {
                        if (magnet === torrent.magnetURI) {
                            this.seededFiles.delete(file);
                        }
                    }
                    await this.client.remove(torrent.infoHash);
                }
            } catch (err: any) {
                console.error("Error removing torrent:", err);
            }
        }
        // Last, so the torrent is already gone by the time the caller's await
        // returns. No-op for a torrent that finished and is only seeding.
        pending?.cancel();
    }

    public stop() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
            this.seededFiles.clear();
        }
        // Settle anything still in flight; destroy() fires no per-torrent events.
        for (const entry of new Set(this.pending.values())) entry.cancel();
        this.pending.clear();
    }
}
