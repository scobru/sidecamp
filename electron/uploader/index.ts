import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

export interface UploaderConfig {
    server: string;
    token: string;
}

export class TuneCampUploader {
    private config: UploaderConfig;

    constructor(config: UploaderConfig) {
        this.config = config;
    }

    public setConfig(config: UploaderConfig) {
        this.config = config;
    }

    /**
     * Uploads a local file to TuneCamp via the /api/admin/upload/tracks endpoint
     */
    public async uploadTrack(filePath: string, metadata?: { releaseSlug?: string, artist?: string, album?: string, artistId?: number }): Promise<any> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const formData = new FormData();
        
        // Append the file stream
        const fileStream = fs.createReadStream(filePath);
        formData.append('files', fileStream, path.basename(filePath));

        // Append optional metadata hints for TuneCamp's scanner
        if (metadata?.releaseSlug) formData.append('releaseSlug', metadata.releaseSlug);
        if (metadata?.artist) formData.append('artist', metadata.artist);
        if (metadata?.title) formData.append('title', metadata.title);
        if (metadata?.album) formData.append('album', metadata.album);
        if (metadata?.artistId) formData.append('artistId', metadata.artistId.toString());

        const uploadUrl = `${this.config.server.replace(/\/$/, '')}/api/admin/upload/tracks`;

        try {
            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${this.config.token}`
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            
            return response.data;
        } catch (error: any) {
            if (error.response) {
                throw new Error(`Upload failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`Upload failed: ${error.message}`);
        }
    }
}
