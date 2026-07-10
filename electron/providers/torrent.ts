import type WebTorrent from 'webtorrent';
import { EventEmitter } from 'events';
import path from 'path';

export class TorrentService extends EventEmitter {
    private client: WebTorrent.Instance | null = null;
    private downloadDir: string;
    private seededFiles: Map<string, string> = new Map(); // filePath -> magnetURI

    constructor(downloadDir: string) {
        super();
        this.downloadDir = downloadDir;
    }

    private async ensureClient(): Promise<WebTorrent.Instance> {
        if (!this.client) {
            const WebTorrentClass = (await import('webtorrent')).default;
            this.client = new WebTorrentClass({ utp: false });
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

                const emitProgress = () => {
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

                torrent.on('upload', emitProgress);
                torrent.on('download', emitProgress);

                emitProgress();
                resolve(torrent.magnetURI);
            });
        });
    }

    public async download(magnetUri: string): Promise<string[]> {
        return new Promise(async (resolve, reject) => {
            let client;
            try {
                client = await this.ensureClient();
            } catch (err) {
                return reject(err);
            }
            this.emit('log', `Inizio download magnet...`);

            client.add(magnetUri, { path: this.downloadDir }, (torrent) => {
                this.emit('log', `Metadati ricevuti: ${torrent.name}`);
                
                torrent.on('download', () => {
                    this.emit('progress', {
                        id: torrent.infoHash,
                        name: torrent.name,
                        progress: torrent.progress,
                        speed: torrent.downloadSpeed,
                        uploadSpeed: torrent.uploadSpeed,
                        downloaded: torrent.downloaded,
                        total: torrent.length,
                        seeding: torrent.done
                    });
                });

                torrent.on('upload', () => {
                    this.emit('progress', {
                        id: torrent.infoHash,
                        name: torrent.name,
                        progress: torrent.progress,
                        speed: torrent.downloadSpeed,
                        uploadSpeed: torrent.uploadSpeed,
                        downloaded: torrent.downloaded,
                        total: torrent.length,
                        seeding: torrent.done
                    });
                });

                torrent.on('done', () => {
                    this.emit('log', `Download completato e in seeding: ${torrent.name}`);
                    const files = torrent.files.map(f => path.join(this.downloadDir, f.path));
                    resolve(files);
                });

                torrent.on('error', (err) => {
                    reject(err);
                });
            });
        });
    }

    public async remove(infoHash: string) {
        if (!infoHash || infoHash === 'undefined') {
            return;
        }
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
    }

    public stop() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
            this.seededFiles.clear();
        }
    }
}
