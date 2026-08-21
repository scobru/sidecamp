import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

export class NetworkService extends EventEmitter {
  private downloadDir: string;

  constructor(downloadDir: string) {
    super();
    this.downloadDir = downloadDir;
  }

  /** Scrive una risposta in streaming nella cartella download, emettendo 'progress' se c'e' un downloadId. */
  private saveStream(response: Response, artist: string, title: string, downloadId?: string): Promise<string> {
    const contentDisposition = response.headers.get('content-disposition') || '';
    const match = contentDisposition.match(/filename="(.+?)"/);
    const filename = (match ? match[1] : `${artist || 'Unknown Artist'} - ${title || 'Track'}.mp3`)
      .replace(/[<>:"/\\|?*]/g, '_');
    const destPath = path.join(this.downloadDir, filename);

    const total = Number(response.headers.get('content-length')) || 0;
    let downloaded = 0;
    let lastEmit = 0;

    if (!response.body) {
      return Promise.reject(new Error('Response body is empty'));
    }

    const nodeStream = Readable.fromWeb(response.body as any);

    if (downloadId) {
      nodeStream.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        const now = Date.now();
        if (now - lastEmit < 250) return;
        lastEmit = now;
        // sotto 1: il renderer marca la riga completata a progress >= 1, prima che il file sia chiuso
        this.emit('progress', {
          id: downloadId,
          progress: total ? Math.min(downloaded / total, 0.99) : 0,
          downloaded,
          total: total || undefined,
        });
      });
    }

    const writer = fs.createWriteStream(destPath);
    nodeStream.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(destPath));
      writer.on('error', reject);
    });
  }

  public async authConnect(server: string, mode: 'login' | 'register', username: string, password: string): Promise<any> {
    const cleanServer = server.replace(/\/$/, '');
    try {
      const response = await fetch(`${cleanServer}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        const err: any = await response.json().catch(() => ({}));
        throw new Error(err.error || response.statusText || 'Connection failed');
      }
      return (await response.json()) as any;
    } catch (error: any) {
      throw new Error(error.message || 'Connection failed');
    }
  }

  public async getCommunitySites(server: string): Promise<any> {
    const cleanServer = server.replace(/\/$/, '');
    const response = await fetch(`${cleanServer}/api/community/sites`);
    if (!response.ok) throw new Error(`Failed to get community sites: ${response.status}`);
    return (await response.json()) as any;
  }

  public async getFederatedCatalog(origin: string): Promise<any> {
    // Public, unauthenticated — /api/catalog/full only ever returns the
    // remote instance's Public Stage releases, regardless of who calls it.
    const cleanOrigin = origin.replace(/\/$/, '');
    const response = await fetch(`${cleanOrigin}/api/catalog/full`);
    if (!response.ok) throw new Error(`Failed to get federated catalog: ${response.status}`);
    return (await response.json()) as any;
  }

  public async downloadFederatedCatalogTrack(
    origin: string,
    trackId: string,
    artist: string,
    title: string,
    downloadId?: string
  ): Promise<string> {
    // Streams directly from the remote instance's public /stream endpoint —
    // no local server/token involved, unlike downloadCatalogTrack/downloadPeerTrack.
    const cleanOrigin = origin.replace(/\/$/, '');
    const url = `${cleanOrigin}/api/tracks/${trackId}/stream`;

    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return this.saveStream(response, artist, title, downloadId);
  }

  public async getPeers(server: string, token: string): Promise<any> {
    const cleanServer = server.replace(/\/$/, '');
    const response = await fetch(`${cleanServer}/api/peers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Failed to get peers: ${response.status}`);
    return (await response.json()) as any;
  }

  // Chat roster, not the sharing roster: /api/peers only lists daemon sessions
  // on /ws/peer, so webapp users (who connect to /ws/chat) are invisible there.
  // The lobby is shared by both transports, so the chat recipient list must come
  // from the chat registry instead.
  public async getChatPeers(server: string, token: string): Promise<any> {
    const cleanServer = server.replace(/\/$/, '');
    const response = await fetch(`${cleanServer}/api/chat/peers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return [];
    const data: any = await response.json().catch(() => ({}));
    return data?.clients ?? [];
  }

  public async getPeerTracks(server: string, token: string, sessionId: string, origin?: string): Promise<any> {
    const cleanServer = server.replace(/\/$/, '');
    const url = origin
      ? `${cleanServer}/api/peers/${sessionId}/tracks?origin=${encodeURIComponent(origin)}`
      : `${cleanServer}/api/peers/${sessionId}/tracks`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Failed to get peer tracks: ${response.status}`);
    return (await response.json()) as any;
  }

  public async downloadPeerTrack(
    server: string,
    token: string,
    sessionId: string,
    trackId: string,
    artist: string,
    title: string,
    origin?: string,
    downloadId?: string
  ): Promise<string> {
    // Remote federated instances have no knowledge of our local JWT and expose
    // their download endpoint publicly (opt-in), so we fetch directly from the
    // origin instead of tunneling through our own server.
    const url = origin
      ? `${origin.replace(/\/$/, '')}/api/peers/${sessionId}/tracks/${trackId}/federated-download`
      : `${server.replace(/\/$/, '')}/api/peers/${sessionId}/tracks/${trackId}/download?token=${token}`;

    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }

    const response = await fetch(url, {
      headers: origin ? {} : { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return this.saveStream(response, artist, title, downloadId);
  }

  public async getCatalogTracks(server: string, token: string): Promise<any> {
    const cleanServer = server.replace(/\/$/, '');
    const response = await fetch(`${cleanServer}/api/tracks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Failed to get catalog tracks: ${response.status}`);
    return (await response.json()) as any;
  }

  public async downloadCatalogTrack(
    server: string,
    token: string,
    trackId: string,
    artist: string,
    title: string,
    downloadId?: string
  ): Promise<string> {
    const cleanServer = server.replace(/\/$/, '');
    const url = `${cleanServer}/api/tracks/${trackId}/download`;

    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return this.saveStream(response, artist, title, downloadId);
  }
}
