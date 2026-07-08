import fs from 'fs';
import path from 'path';
import axios from 'axios';

export class NetworkService {
  private downloadDir: string;

  constructor(downloadDir: string) {
    this.downloadDir = downloadDir;
  }

  public async getPeers(server: string, token: string) {
    const cleanServer = server.replace(/\/$/, '');
    const response = await axios.get(`${cleanServer}/api/peers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }

  public async getPeerTracks(server: string, token: string, sessionId: string) {
    const cleanServer = server.replace(/\/$/, '');
    const response = await axios.get(`${cleanServer}/api/peers/${sessionId}/tracks`, {
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
    title: string
  ): Promise<string> {
    const cleanServer = server.replace(/\/$/, '');
    const url = `${cleanServer}/api/peers/${sessionId}/tracks/${trackId}/download?token=${token}`;

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
