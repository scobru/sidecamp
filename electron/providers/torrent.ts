import type WebTorrent from 'webtorrent';
import { EventEmitter } from 'events';
import path from 'path';

export class TorrentService extends EventEmitter {
    private client: WebTorrent.Instance | null = null;
    private downloadDir: string;

    constructor(downloadDir: string) {
        super();
        this.downloadDir = downloadDir;
    }

    public async download(magnetUri: string): Promise<string[]> {
        return new Promise(async (resolve, reject) => {
            if (!this.client) {
                try {
                    const WebTorrentClass = (await import('webtorrent')).default;
                    this.client = new WebTorrentClass({ utp: false });
                    this.client.on('error', (err: any) => {
                        console.error("WebTorrent error:", err);
                        this.emit('error', err);
                    });
                } catch (err) {
                    return reject(err);
                }
            }
            this.emit('log', `Inizio download magnet...`);

            this.client.add(magnetUri, { path: this.downloadDir }, (torrent) => {
                this.emit('log', `Metadati ricevuti: ${torrent.name}`);
                
                torrent.on('download', (bytes) => {
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

                torrent.on('upload', (bytes) => {
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

    public remove(infoHash: string) {
        if (this.client) {
            const torrent = this.client.get(infoHash);
            if (torrent) {
                this.emit('log', `Rimozione torrent e stop seeding per: ${torrent.name}`);
                torrent.destroy();
            }
        }
    }

    public stop() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
    }
}
