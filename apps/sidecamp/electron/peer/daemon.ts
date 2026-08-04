import fs from "fs";
import path from "path";
import crypto from "crypto";
import { app } from "electron";
import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { generateKeyPair, encryptFor, decryptFrom, type KeyPair } from "../../src/services/e2eCrypto";

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
    // E2E chat identity, persisted to disk so it's stable across app restarts
    // (otherwise every launch orphans ciphertext peers sent to the old key).
    // Exchanged with peers over the existing peer WS ('pubkey' messages) —
    // the relay server never sees plaintext.
    private myKeyPair: KeyPair | null = null;
    private keyPairPromise: Promise<KeyPair> | null = null;
    private readonly peerPublicKeys = new Map<string, string>();

    constructor(config: PeerConfig, getMagnetUriForFile?: (filePath: string) => string | undefined) {
        super();
        this.config = config;
        this.getMagnetUriForFile = getMagnetUriForFile;
    }

    public setConfig(config: PeerConfig) {
        this.config = config;
    }

    private keyPairFilePath(): string {
        return path.join(app.getPath('userData'), 'peer-chat-identity.json');
    }

    private async ensureKeyPair(): Promise<KeyPair> {
        if (this.myKeyPair) return this.myKeyPair;
        if (!this.keyPairPromise) {
            this.keyPairPromise = (async () => {
                const filePath = this.keyPairFilePath();
                try {
                    const raw = await fs.promises.readFile(filePath, 'utf-8');
                    const pair = JSON.parse(raw) as KeyPair;
                    this.myKeyPair = pair;
                    return pair;
                } catch {
                    const pair = await generateKeyPair();
                    try {
                        await fs.promises.writeFile(filePath, JSON.stringify(pair));
                    } catch (err: any) {
                        this.emit("log", `Impossibile salvare l'identità chat su disco: ${err.message}`);
                    }
                    this.myKeyPair = pair;
                    return pair;
                }
            })();
        }
        return this.keyPairPromise;
    }

    public async scanFolders(): Promise<any[]> {
        this.emit("log", "Avvio scansione cartelle locali...");
        this.fileIndex.clear();
        
        const validExtensions = new Set(['.mp3', '.flac', '.ogg', '.m4a', '.wav']);
        let files: string[] = [];

        const allFolders = (Array.isArray(this.config.folders) 
            ? this.config.folders 
            : [this.config.folders as any])
            .flatMap(f => f.split(/[,;]/))
            .map(f => f.trim())
            .filter(f => f.length > 0);

        for (const folder of allFolders) {
            try {
                const stat = await fs.promises.stat(folder);
                if (stat.isDirectory()) {
                    await this.walkDir(folder, files);
                }
            } catch (e) {}
        }

        files = files.filter(f => validExtensions.has(path.extname(f).toLowerCase()));
        this.emit("log", `Trovati ${files.length} file audio. Estrazione metadati...`);

        const indexData: any[] = [];
        let processed = 0;

        const musicMetadata = await import("music-metadata");
        const CONCURRENCY = 8;
        for (let i = 0; i < files.length; i += CONCURRENCY) {
            const batch = files.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(async (file) => {
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
                } catch (err: any) {
                    this.emit("log", `Errore lettura metadati per ${file}: ${err.message}`);
                } finally {
                    processed++;
                }
            }));
            this.emit("progress", processed, files.length);
        }

        this.emit("log", `Scansione completata. ${indexData.length} tracce indicizzate.`);
        return indexData;
    }

    private async walkDir(dir: string, files: string[] = []) {
        try {
            const list = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const item of list) {
                const itemPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    await this.walkDir(itemPath, files);
                } else {
                    files.push(itemPath);
                }
            }
        } catch (e) {}
    }

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        await this.ensureKeyPair();
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
            const keyPair = await this.ensureKeyPair();

            // Only walk the filesystem + re-parse metadata on the first connect.
            // Reconnects (WS drops, server restarts) reuse the cached index —
            // rescanning every 5s on a flaky connection pegs the main process
            // and freezes the whole window (Electron's message pump shares its
            // thread with the Node event loop).
            const indexData = this.fileIndex.size > 0
                ? Array.from(this.fileIndex.values()).map(t => ({ ...t, path: undefined }))
                : await this.scanFolders();

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

            this.ws.on('message', async (data: any) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'auth_ok') {
                        this.emit("status", "online");
                        this.emit("log", `Connesso a TuneCamp (Sessione: ${msg.sessionId}). Invio indice libreria...`);
                        this.ws?.send(JSON.stringify({ type: 'pubkey', pubkey: keyPair.publicKey }));
                        this.ws?.send(JSON.stringify({
                            type: 'manifest',
                            tracks: indexData
                        }));
                    } else if (msg.type === 'pubkey') {
                        this.peerPublicKeys.set(msg.from, msg.pubkey);
                    } else if (msg.type === 'chat') {
                        if (msg.lobby) {
                            this.emit("chat", { from: msg.from, text: msg.text, ts: msg.ts, lobby: true });
                        } else {
                            const senderKey = this.peerPublicKeys.get(msg.from);
                            const plain = senderKey ? await decryptFrom(msg.text, senderKey, keyPair.secretKey) : null;
                            this.emit("chat", { from: msg.from, text: plain ?? '[Encrypted message — key exchange pending]', ts: msg.ts, e2e: true });
                        }
                    } else if (msg.type === 'ping') {
                        this.ws?.send(JSON.stringify({ type: 'pong' }));
                    } else if (msg.type === 'stream_request' || msg.type === 'download_request') {
                        this.handleRequest(msg.requestId, msg.trackId);
                    } else if (msg.type === 'cancel_request') {
                        this.handleCancel(msg.requestId);
                    } else if (msg.type === 'rtc_signal') {
                        this.handleRtcSignal(msg.fromSessionId || msg.from, msg.from, msg.signal);
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
                this.applyBackpressure(stream, () => this.ws?.bufferedAmount ?? 0);
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

    public async sendChat(to: string, text: string): Promise<{ success: boolean; error?: string; e2e?: boolean }> {
        if (this.ws?.readyState !== WebSocket.OPEN) return { success: false, error: 'Not connected' };
        const keyPair = await this.ensureKeyPair();
        let payload = text;
        let e2e = false;
        if (to) {
            const pubkey = this.peerPublicKeys.get(to);
            if (pubkey) {
                payload = await encryptFor(text, pubkey, keyPair.secretKey);
                e2e = true;
            }
            // no pubkey → send plaintext (peer on older version or key exchange pending)
        }
        this.ws.send(JSON.stringify({ type: 'chat', to, text: payload }));
        return { success: true, e2e };
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

    // Torrent seed/remove only change a track's magnetUri — refresh that field
    // from the in-memory index and resend, instead of re-walking + re-parsing
    // the whole library (rescanAndSendManifest).
    public refreshAndSendManifest() {
        if (!this.isRunning || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (this.getMagnetUriForFile) {
            for (const track of this.fileIndex.values()) {
                track.magnetUri = this.getMagnetUriForFile(track.path);
            }
        }
        const indexData = Array.from(this.fileIndex.values()).map(t => ({ ...t, path: undefined }));
        this.ws.send(JSON.stringify({
            type: 'manifest',
            tracks: indexData
        }));
        this.emit("log", "Indice libreria aggiornato inviato al server.");
    }

    private rtcPeerConnections: Map<string, any> = new Map();

    private async handleRtcSignal(fromSessionId: string, fromUsername: string, signal: any) {
        if (!signal) return;
        const PeerConnection = (globalThis as any).RTCPeerConnection || (global as any).RTCPeerConnection;
        if (!PeerConnection) {
            this.emit("log", "WebRTC non supportato nel processo corrente, impossibile accettare signaling P2P.");
            return;
        }

        let pc = this.rtcPeerConnections.get(fromSessionId);

        if (signal.type === 'offer') {
            if (pc) {
                try { pc.close(); } catch {}
            }
            pc = new PeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            this.rtcPeerConnections.set(fromSessionId, pc);

            pc.onicecandidate = (event: any) => {
                if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'rtc_signal',
                        toSessionId: fromSessionId,
                        to: fromUsername,
                        signal: { type: 'candidate', candidate: event.candidate }
                    }));
                }
            };

            pc.ondatachannel = (event: any) => {
                const channel = event.channel;
                this.emit("log", `Connessione DataChannel WebRTC aperta con ${fromUsername} (${fromSessionId})`);
                channel.onmessage = (e: any) => {
                    try {
                        const req = JSON.parse(e.data);
                        if (req.type === 'request_track' && req.trackId) {
                            this.streamTrackOverDataChannel(channel, req.requestId || req.trackId, req.trackId);
                        }
                    } catch (err) {
                        console.error("DataChannel parse error:", err);
                    }
                };
            };

            const RTCSessionDescriptionClass = (globalThis as any).RTCSessionDescription || (global as any).RTCSessionDescription;
            await pc.setRemoteDescription(new RTCSessionDescriptionClass(signal.sdp || signal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'rtc_signal',
                    toSessionId: fromSessionId,
                    to: fromUsername,
                    signal: { type: 'answer', sdp: answer }
                }));
            }
        } else if (signal.type === 'candidate' && pc) {
            try {
                const RTCIceCandidateClass = (globalThis as any).RTCIceCandidate || (global as any).RTCIceCandidate;
                await pc.addIceCandidate(new RTCIceCandidateClass(signal.candidate));
            } catch (err) {
                console.error("Error adding ICE candidate:", err);
            }
        }
    }

    private streamTrackOverDataChannel(channel: any, requestId: string, trackId: string) {
        const track = this.fileIndex.get(trackId);
        if (!track || !fs.existsSync(track.path)) {
            channel.send(JSON.stringify({ type: 'chunk_error', requestId, message: 'File non trovato' }));
            return;
        }

        this.emit("log", `[WebRTC P2P] Streaming avviato: ${track.title}`);
        const stream = fs.createReadStream(track.path, { highWaterMark: 64 * 1024 });
        let seq = 0;

        stream.on('data', (chunk: Buffer) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify({
                    type: 'chunk',
                    requestId,
                    seq: seq++,
                    data: chunk.toString('base64')
                }));
                this.applyBackpressure(stream, () => channel.bufferedAmount ?? 0);
            } else {
                stream.destroy();
            }
        });

        stream.on('end', () => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify({ type: 'chunk_end', requestId }));
            }
            this.emit("log", `[WebRTC P2P] Streaming completato: ${track.title}`);
        });

        stream.on('error', (err: any) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify({ type: 'chunk_error', requestId, message: err.message }));
            }
        });
    }

    // No backpressure between fs.ReadStream and ws/datachannel send means a slow
    // peer lets chunks pile up in the socket's send buffer unbounded, ballooning
    // main-process heap and blocking Electron's message pump (app "not responding").
    // Pause the read side once buffered data crosses the threshold, resume once drained.
    private static readonly BACKPRESSURE_THRESHOLD = 4 * 1024 * 1024;

    private applyBackpressure(stream: fs.ReadStream, getBufferedAmount: () => number) {
        if (getBufferedAmount() <= PeerDaemon.BACKPRESSURE_THRESHOLD) return;
        stream.pause();
        const check = () => {
            if (stream.destroyed) return;
            if (getBufferedAmount() <= PeerDaemon.BACKPRESSURE_THRESHOLD) {
                stream.resume();
            } else {
                setTimeout(check, 50);
            }
        };
        setTimeout(check, 50);
    }

    private cleanupStreams() {
        for (const [id, stream] of this.activeStreams.entries()) {
            stream.destroy();
        }
        this.activeStreams.clear();
        for (const [id, pc] of this.rtcPeerConnections.entries()) {
            try { pc.close(); } catch {}
        }
        this.rtcPeerConnections.clear();
    }
}
