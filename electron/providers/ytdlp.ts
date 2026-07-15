import { execFile } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import ffmpeg from '@ffmpeg-installer/ffmpeg';

const YTDLP_BINARY_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';
const YTDLP_RELEASE_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YTDLP_BINARY_NAME}`;

export class YtdlpService extends EventEmitter {
    private downloadDir: string;
    private binDir: string;

    constructor(downloadDir: string, binDir: string) {
        super();
        this.downloadDir = downloadDir;
        this.binDir = binDir;
    }

    // ponytail: yt-dlp non e' bundlabile via npm (binario nativo per piattaforma) -> scaricato on-demand invece di richiedere installazione manuale
    private async ensureYtdlp(): Promise<string> {
        const binPath = path.join(this.binDir, YTDLP_BINARY_NAME);
        if (fs.existsSync(binPath)) {
            return binPath;
        }

        this.emit('log', 'yt-dlp non trovato, scarico binario ufficiale...');
        fs.mkdirSync(this.binDir, { recursive: true });

        const response = await axios({ method: 'get', url: YTDLP_RELEASE_URL, responseType: 'stream' });
        const writer = fs.createWriteStream(binPath);
        response.data.pipe(writer);
        await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', reject);
        });

        if (process.platform !== 'win32') {
            fs.chmodSync(binPath, 0o755);
        }

        this.emit('log', 'yt-dlp scaricato.');
        return binPath;
    }

    public async download(url: string): Promise<string> {
        try {
            new URL(url);
        } catch (e) {
            throw new Error('Invalid URL provided');
        }

        const binPath = await this.ensureYtdlp();

        return new Promise((resolve, reject) => {
            this.emit('log', `Inizio download yt-dlp per ${url}`);

            const outputPath = path.join(this.downloadDir, '%(title)s.%(ext)s');
            // ponytail: UA non-browser evita la challenge Fastly di Bandcamp
            // (yt-dlp finge un UA browser su TLS non-browser -> flaggato come bot)
            const args = [
                '-x', '--audio-format', 'mp3',
                '--user-agent', 'curl/8.9.1',
                '--ffmpeg-location', ffmpeg.path,
                '-o', outputPath,
                '--', url
            ];

            const child = execFile(binPath, args, (error, stdout) => {
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
