import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { EventEmitter } from 'events';

export class NetworkService extends EventEmitter {
  private downloadDir: string;

  constructor(downloadDir: string) {
    super();
    this.downloadDir = downloadDir;
  }

  /** Scrive una risposta in streaming nella cartella download, emettendo 'progress' se c'e' un downloadId. */
  private saveStream(response: any, artist: string, title: string, downloadId?: string): Promise<string> {
    const match = String(response.headers['content-disposition'] || '').match(/filename="(.+?)"/);
    const filename = (match ? match[1] : `${artist || 'Unknown Artist'} - ${title || 'Track'}.mp3`)
      .replace(/[<>:"/\\|?*]/g, '_');
    const destPath = path.join(this.downloadDir, filename);

    const total = Number(response.headers['content-length']) || 0;
    let downloaded = 0;
    let lastEmit = 0;
    if (downloadId) {
      response.data.on('data', (chunk: Buffer) => {
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
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(destPath));
      writer.on('error', reject);
    });
  }

  public async authConnect(server: string, mode: 'login' | 'register', username: string, password: string) {
    const cleanServer = server.replace(/\/$/, '');
    try {
      const response = await axios.post(`${cleanServer}/api/auth/${mode}`, { username, password });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Connection failed');
    }
  }

  public async getCommunitySites(server: string) {
    const cleanServer = server.replace(/\/$/, '');
    const response = await axios.get(`${cleanServer}/api/community/sites`);
    return response.data;
  }

  public async getFederatedCatalog(origin: string) {
    // Public, unauthenticated — /api/catalog/full only ever returns the
    // remote instance's Public Stage releases, regardless of who calls it.
    const cleanOrigin = origin.replace(/\/$/, '');
    const response = await axios.get(`${cleanOrigin}/api/catalog/full`);
    return response.data;
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

    const response = await axios({ method: 'get', url, responseType: 'stream' });
    return this.saveStream(response, artist, title, downloadId);
  }

  public async getPeers(server: string, token: string) {
    const cleanServer = server.replace(/\/$/, '');
    const response = await axios.get(`${cleanServer}/api/peers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }

  // Chat roster, not the sharing roster: /api/peers only lists daemon sessions
  // on /ws/peer, so webapp users (who connect to /ws/chat) are invisible there.
  // The lobby is shared by both transports, so the chat recipient list must come
  // from the chat registry instead.
  public async getChatPeers(server: string, token: string) {
    const cleanServer = server.replace(/\/$/, '');
    const response = await axios.get(`${cleanServer}/api/chat/peers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data?.clients ?? [];
  }

  public async getPeerTracks(server: string, token: string, sessionId: string, origin?: string) {
    const cleanServer = server.replace(/\/$/, '');
    const url = origin
      ? `${cleanServer}/api/peers/${sessionId}/tracks?origin=${encodeURIComponent(origin)}`
      : `${cleanServer}/api/peers/${sessionId}/tracks`;
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
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

    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: origin ? {} : { 'Authorization': `Bearer ${token}` }
    });

    return this.saveStream(response, artist, title, downloadId);
  }

  public async getCatalogTracks(server: string, token: string) {
    const cleanServer = server.replace(/\/$/, '');
    const response = await axios.get(`${cleanServer}/api/tracks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
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

    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    return this.saveStream(response, artist, title, downloadId);
  }
}
