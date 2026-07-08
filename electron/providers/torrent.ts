import WebTorrent from 'webtorrent';
import { EventEmitter } from 'events';
import path from 'path';

export class TorrentService extends EventEmitter {
    private client: WebTorrent.Instance | null = null;
    private downloadDir: string;

    constructor(downloadDir: string) {
        super();
        this.downloadDir = downloadDir;
        this.client = new WebTorrent({ utp: false });
        
        this.client.on('error', (err) => {
            console.error("WebTorrent error:", err);
            this.emit('error', err);
        });
    }

    public async download(magnetUri: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            if (!this.client) return reject(new Error("Client not initialized"));

            this.emit('log', `Inizio download magnet...`);

            this.client.add(magnetUri, { path: this.downloadDir }, (torrent) => {
                this.emit('log', `Metadati ricevuti: ${torrent.name}`);
                
                torrent.on('download', (bytes) => {
                    this.emit('progress', {
                        id: torrent.infoHash,
                        progress: torrent.progress,
                        speed: torrent.downloadSpeed,
                        downloaded: torrent.downloaded,
                        total: torrent.length
                    });
                });

                torrent.on('done', () => {
                    this.emit('log', `Download completato: ${torrent.name}`);
                    const files = torrent.files.map(f => path.join(this.downloadDir, f.path));
                    resolve(files);
                    // Non distruggiamo il torrent subito se vogliamo fare seed, ma per sidecamp
                    // potremmo fermarlo per liberare spazio
                    torrent.destroy();
                });

                torrent.on('error', (err) => {
                    reject(err);
                });
            });
        });
    }

    public stop() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
    }
}
