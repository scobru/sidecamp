import { execFile } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';

export class YtdlpService extends EventEmitter {
    private downloadDir: string;

    constructor(downloadDir: string) {
        super();
        this.downloadDir = downloadDir;
    }

    public async download(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.emit('log', `Inizio download yt-dlp per ${url}`);
            
            // Scarica il miglior audio, estrai l'audio in formato mp3/opus, ecc.
            // Esempio base con esecuzione comando (necessita yt-dlp installato)
            const outputPath = path.join(this.downloadDir, '%(title)s.%(ext)s');
            // ponytail: UA non-browser evita la challenge Fastly di Bandcamp
            // (yt-dlp finge un UA browser su TLS non-browser -> flaggato come bot)

            try {
                new URL(url);
            } catch (e) {
                return reject(new Error('Invalid URL provided'));
            }
            const args = ['-x', '--audio-format', 'mp3', '--user-agent', 'curl/8.9.1', '-o', outputPath, '--', url];

            const child = execFile('yt-dlp', args, (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }
                
                // Parser rozzo per trovare il file generato
                const lines = stdout.split('\n');
                let downloadedFile = '';
                for (const line of lines) {
                    if (line.includes('Destination:') && line.includes('.mp3')) {
                        downloadedFile = line.split('Destination:')[1].trim();
                    }
                }
                
                this.emit('log', `Download completato: ${downloadedFile}`);
                resolve(downloadedFile);
            });

            child.stdout?.on('data', (data) => this.emit('log', data.toString().trim()));
            child.stderr?.on('data', (data) => this.emit('log', data.toString().trim()));
        });
    }
}
