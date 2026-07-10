import fs from "fs";
import path from "path";
import crypto from "crypto";
import { WebSocket } from "ws";
import { EventEmitter } from "events";

export interface PeerConfig {
    server: string;
    token: string;
    folders: string[];
    allowDownloads: boolean;
}

export class PeerDaemon extends EventEmitter {
    private config: PeerConfig;
    private ws: WebSocket | null = null;
    private fileIndex: Map<string, any> = new Map();
    private activeStreams: Map<string, fs.ReadStream> = new Map();
    private isRunning: boolean = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private getMagnetUriForFile?: (filePath: string) => string | undefined;

    constructor(config: PeerConfig, getMagnetUriForFile?: (filePath: string) => string | undefined) {
        super();
        this.config = config;
        this.getMagnetUriForFile = getMagnetUriForFile;
    }

    public setConfig(config: PeerConfig) {
        this.config = config;
    }

    public async scanFolders(): Promise<any[]> {
        this.emit("log", "Avvio scansione cartelle locali...");
        this.fileIndex.clear();
        
        const validExtensions = new Set(['.mp3', '.flac', '.ogg', '.m4a', '.wav']);
        let files: string[] = [];

        for (const folder of this.config.folders) {
            if (fs.existsSync(folder)) {
                this.walkDir(folder, files);
            }
        }

        files = files.filter(f => validExtensions.has(path.extname(f).toLowerCase()));
        this.emit("log", `Trovati ${files.length} file audio. Estrazione metadati...`);

        const indexData = [];
        let processed = 0;

        const musicMetadata = await import("music-metadata");
        for (const file of files) {
            try {
                const [metadata, stat] = await Promise.all([
                    musicMetadata.parseFile(file),
                    fs.promises.stat(file)
                ]);
                
                const trackData = {
                    id: crypto.createHash('md5').update(file).digest('hex'),
                    path: file,
                    title: metadata.common.title || path.basename(file, path.extname(file)),
                    artist: metadata.common.artist || 'Unknown Artist',
                    album: metadata.common.album || 'Unknown Album',
                    duration: metadata.format.duration || 0,
                    sizeBytes: stat.size,
                    fileSizeBytes: stat.size,
                    format: path.extname(file).substring(1).toLowerCase(),
                    mimeType: metadata.format.container || path.extname(file).substring(1).toLowerCase(),
                    bitrate: metadata.format.bitrate || 0,
                    allowDownload: this.config.allowDownloads,
                    magnetUri: this.getMagnetUriForFile ? this.getMagnetUriForFile(file) : undefined
                };

                this.fileIndex.set(trackData.id, trackData);
                indexData.push({ ...trackData, path: undefined }); // Don't leak local paths
                
                processed++;
                if (processed % 100 === 0) {
                    this.emit("progress", processed, files.length);
                }
            } catch (err: any) {
                this.emit("log", `Errore lettura metadati per ${file}: ${err.message}`);
            }
        }

        this.emit("progress", processed, files.length);
        this.emit("log", `Scansione completata. ${indexData.length} tracce indicizzate.`);
        return indexData;
    }

    private walkDir(dir: string, files: string[] = []) {
        const list = fs.readdirSync(dir);
        for (const item of list) {
            const itemPath = path.join(dir, item);
            try {
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    this.walkDir(itemPath, files);
                } else {
                    files.push(itemPath);
                }
            } catch (e) {}
        }
    }

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        await this.connect();
    }

    public stop() {
        this.isRunning = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.cleanupStreams();
        this.emit("status", "offline");
    }

    private async connect() {
        if (!this.isRunning) return;
        
        try {
            const indexData = await this.scanFolders();
            
            const wsUrl = new URL(this.config.server);
            wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl.pathname = '/ws/peer';
            wsUrl.searchParams.set('token', this.config.token);
            wsUrl.searchParams.set('allowDownloads', String(this.config.allowDownloads));
            
            this.emit("status", "connecting");
            
            this.ws = new WebSocket(wsUrl.toString());

            this.ws.on('open', () => {
                this.emit("log", "WebSocket connesso. In attesa di autorizzazione...");
            });

            this.ws.on('message', (data: any) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'auth_ok') {
                        this.emit("status", "online");
                        this.emit("log", `Connesso a TuneCamp (Sessione: ${msg.sessionId}). Invio indice libreria...`);
                        
                        this.ws?.send(JSON.stringify({
                            type: 'manifest',
                            tracks: indexData
                        }));
                    } else if (msg.type === 'ping') {
                        this.ws?.send(JSON.stringify({ type: 'pong' }));
                    } else if (msg.type === 'stream_request' || msg.type === 'download_request') {
                        this.handleRequest(msg.requestId, msg.trackId);
                    } else if (msg.type === 'cancel_request') {
                        this.handleCancel(msg.requestId);
                    }
                } catch (err) {
                    console.error("Parse error", err);
                }
            });

            this.ws.on('close', () => {
                this.emit("status", "disconnected");
                this.cleanupStreams();
                if (this.isRunning) {
                    this.emit("log", "Connessione persa. Riconnessione tra 5s...");
                    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
                }
            });

            this.ws.on('error', (err: any) => {
                this.emit("log", `Errore WebSocket: ${err.message}`);
                this.ws?.close();
            });
            
        } catch (err: any) {
            this.emit("log", `Errore di avvio: ${err.message}`);
            if (this.isRunning) {
                this.reconnectTimer = setTimeout(() => this.connect(), 5000);
            }
        }
    }

    private handleRequest(requestId: string, trackId: string) {
        const track = this.fileIndex.get(trackId);
        if (!track || !fs.existsSync(track.path)) {
            this.ws?.send(JSON.stringify({ type: 'chunk_error', requestId, message: 'File non trovato' }));
            return;
        }

        this.emit("log", `Streaming/Download richiesto: ${track.title} [Req: ${requestId}]`);

        const stream = fs.createReadStream(track.path, { highWaterMark: 64 * 1024 });
        this.activeStreams.set(requestId, stream);
        let seq = 0;

        stream.on('data', (chunk: Buffer) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ 
                    type: 'chunk', 
                    requestId, 
                    seq: seq++, 
                    data: chunk.toString('base64') 
                }));
            } else {
                stream.destroy();
            }
        });

        stream.on('end', () => {
            this.ws?.send(JSON.stringify({ type: 'chunk_end', requestId }));
            this.activeStreams.delete(requestId);
            this.emit("log", `Streaming/Download completato: ${track.title} [Req: ${requestId}]`);
        });

        stream.on('error', (err) => {
            this.ws?.send(JSON.stringify({ type: 'chunk_error', requestId, message: err.message }));
            this.activeStreams.delete(requestId);
        });
    }

    private handleCancel(requestId: string) {
        const stream = this.activeStreams.get(requestId);
        if (stream) {
            stream.destroy();
            this.activeStreams.delete(requestId);
            this.emit("log", `Streaming/Download cancellato [Req: ${requestId}]`);
        }
    }

    public async rescanAndSendManifest() {
        if (!this.isRunning || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        try {
            const indexData = await this.scanFolders();
            this.ws.send(JSON.stringify({
                type: 'manifest',
                tracks: indexData
            }));
            this.emit("log", "Indice libreria aggiornato inviato al server.");
        } catch (err: any) {
            this.emit("log", `Errore durante l'aggiornamento dell'indice libreria: ${err.message}`);
        }
    }

    private cleanupStreams() {
        for (const [id, stream] of this.activeStreams.entries()) {
            stream.destroy();
        }
        this.activeStreams.clear();
    }
}
