import { execFile } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

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

    // yt-dlp cerca ffprobe nella stessa cartella di ffmpeg via --ffmpeg-location:
    // @ffmpeg-installer e @ffprobe-installer non garantiscono stessa dir -> li colochiamo insieme
    private ensureFfmpegDir(): string {
        if (!fs.existsSync(this.binDir)) {
            fs.mkdirSync(this.binDir, { recursive: true });
        }

        const ffmpegDest = path.join(this.binDir, path.basename(ffmpegInstaller.path));
        if (!fs.existsSync(ffmpegDest)) {
            fs.copyFileSync(ffmpegInstaller.path, ffmpegDest);
            if (process.platform !== 'win32') fs.chmodSync(ffmpegDest, 0o755);
        }

        const ffprobeDest = path.join(this.binDir, path.basename(ffprobeInstaller.path));
        if (!fs.existsSync(ffprobeDest)) {
            fs.copyFileSync(ffprobeInstaller.path, ffprobeDest);
            if (process.platform !== 'win32') fs.chmodSync(ffprobeDest, 0o755);
        }

        return this.binDir;
    }

    // ytsearchN: e' un pseudo-URL yt-dlp nativo -> nessuna API key, nessuna dipendenza esterna.
    public async search(query: string, limit = 15): Promise<any[]> {
        if (!query.trim()) return [];

        const binPath = await this.ensureYtdlp();
        const args = ['--flat-playlist', '--dump-single-json', '--no-warnings', `ytsearch${limit}:${query}`];

        return new Promise((resolve) => {
            execFile(binPath, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
                if (error) {
                    this.emit('log', `Ricerca YouTube fallita: ${error.message}`);
                    return resolve([]);
                }

                try {
                    const data = JSON.parse(stdout);
                    const entries = Array.isArray(data.entries) ? data.entries : [];
                    resolve(entries.map((entry: any) => ({
                        id: 'yt_' + entry.id,
                        title: entry.title || 'Unknown Title',
                        artist: entry.uploader || entry.channel || 'Unknown Artist',
                        album: '',
                        url: entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                        source: 'youtube',
                        size: 0,
                        bitrate: 0,
                        user: 'YouTube'
                    })));
                } catch (e) {
                    this.emit('log', `Parsing risultati YouTube fallito: ${e}`);
                    resolve([]);
                }
            });
        });
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
                '--ffmpeg-location', this.ensureFfmpegDir(),
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
