import fs from 'fs';
import path from 'path';

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
    public async uploadTrack(filePath: string, metadata?: { releaseSlug?: string, artist?: string, title?: string, album?: string, artistId?: number }): Promise<any> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const fileBuffer = await fs.promises.readFile(filePath);
        const fileBlob = new Blob([fileBuffer]);
        const formData = new FormData();

        // Append the file
        formData.append('files', fileBlob, path.basename(filePath));

        // Append optional metadata hints for TuneCamp's scanner
        if (metadata?.releaseSlug) formData.append('releaseSlug', metadata.releaseSlug);
        if (metadata?.artist) formData.append('artist', metadata.artist);
        if (metadata?.title) formData.append('title', metadata.title);
        if (metadata?.album) formData.append('album', metadata.album);
        if (metadata?.artistId) formData.append('artistId', metadata.artistId.toString());

        const uploadUrl = `${this.config.server.replace(/\/$/, '')}/api/admin/upload/tracks`;

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData as any,
                headers: {
                    'Authorization': `Bearer ${this.config.token}`
                }
            });

            if (!response.ok) {
                let errorData: any = '';
                try {
                    errorData = await response.json();
                } catch {
                    errorData = await response.text();
                }
                throw new Error(`Upload failed: ${response.status} - ${typeof errorData === 'object' ? JSON.stringify(errorData) : errorData}`);
            }

            return await response.json();
        } catch (error: any) {
            throw new Error(error.message || 'Upload failed');
        }
    }
}
