import fs from 'fs';
import path from 'path';
import axios from 'axios';

export class NetworkService {
  private downloadDir: string;

  constructor(downloadDir: string) {
    this.downloadDir = downloadDir;
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

  public async getPeers(server: string, token: string) {
    const cleanServer = server.replace(/\/$/, '');
    const response = await axios.get(`${cleanServer}/api/peers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
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
    origin?: string
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

    const contentDisposition = response.headers['content-disposition'];
    let filename = `${artist || 'Unknown Artist'} - ${title || 'Track'}.mp3`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+?)"/);
      if (match) {
        filename = match[1];
      }
    }
    
    // Sanitize filename
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');
    const destPath = path.join(this.downloadDir, filename);

    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(destPath));
      writer.on('error', (err) => reject(err));
    });
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
    title: string
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

    const contentDisposition = response.headers['content-disposition'];
    let filename = `${artist || 'Unknown Artist'} - ${title || 'Track'}.mp3`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+?)"/);
      if (match) {
        filename = match[1];
      }
    }
    
    // Sanitize filename
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');
    const destPath = path.join(this.downloadDir, filename);

    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(destPath));
      writer.on('error', (err) => reject(err));
    });
  }
}
