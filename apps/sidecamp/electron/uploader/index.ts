import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/** Minimum file size (bytes) above which fast partial hashing is used, matching TuneCamp. */
export const FAST_HASH_THRESHOLD = 2 * 1024 * 1024;
const FAST_HASH_CHUNK = 1024 * 1024;

export interface UploaderConfig {
    server: string;
    token: string;
}

export interface ServerTrackSummary {
    id: number | string;
    title: string;
    artist?: string;
    album?: string;
    hash: string;
}

export interface DuplicateCheckResult {
    exists: boolean;
    hash: string;
    match?: ServerTrackSummary;
}

export interface UploadMetadata {
    releaseSlug?: string;
    artist?: string;
    title?: string;
    album?: string;
    artistId?: number;
    force?: boolean;
}

export interface UploadResult {
    skipped: boolean;
    duplicate: boolean;
    hash: string;
    existingTrack?: ServerTrackSummary;
    message?: string;
    results?: any[];
    [key: string]: any;
}

/**
 * Streams an entire file to compute its lowercase MD5 hex digest.
 */
export async function getFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => reject(err));
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function readExact(
    handle: fs.promises.FileHandle,
    length: number,
    position: number,
): Promise<Buffer> {
    const buf = Buffer.alloc(length);
    let offset = 0;
    while (offset < length) {
        const { bytesRead } = await handle.read(buf, offset, length - offset, position + offset);
        if (bytesRead === 0) break;
        offset += bytesRead;
    }
    return offset === length ? buf : buf.subarray(0, offset);
}

/**
 * Computes TuneCamp's fast file hash: full MD5 below 2 MiB, or
 * MD5(first 1 MiB + last 1 MiB + sizeString) for files >= 2 MiB.
 */
export async function getFastFileHash(filePath: string): Promise<string> {
    const stats = await fs.promises.stat(filePath);
    if (stats.size < FAST_HASH_THRESHOLD) {
        return getFileHash(filePath);
    }

    const handle = await fs.promises.open(filePath, 'r');
    try {
        const head = await readExact(handle, FAST_HASH_CHUNK, 0);
        const tail = await readExact(handle, FAST_HASH_CHUNK, stats.size - FAST_HASH_CHUNK);

        const hash = crypto.createHash('md5');
        hash.update(head);
        hash.update(tail);
        hash.update(stats.size.toString());
        return hash.digest('hex');
    } finally {
        await handle.close();
    }
}

export class TuneCampUploader {
    private static readonly CACHE_TTL_MS = 30_000;
    private config: UploaderConfig;
    private hashCache: { key: string; fetchedAt: number; byHash: Map<string, ServerTrackSummary> } | null = null;
    private inflightFetch: { key: string; promise: Promise<Map<string, ServerTrackSummary>> } | null = null;

    constructor(config: UploaderConfig) {
        this.config = {
            server: config.server || '',
            token: config.token || '',
        };
    }

    public setConfig(config: UploaderConfig) {
        const prevServer = this.config.server.replace(/\/$/, '');
        const nextServer = (config.server || '').replace(/\/$/, '');
        const nextToken = config.token || '';
        if (prevServer !== nextServer || this.config.token !== nextToken) {
            this.hashCache = null;
            this.inflightFetch = null;
        }
        this.config = {
            server: config.server || '',
            token: nextToken,
        };
    }

    public invalidateHashCache(): void {
        this.hashCache = null;
        this.inflightFetch = null;
    }

    private async getServerHashMap(refresh = false): Promise<Map<string, ServerTrackSummary>> {
        if (!this.config.server || !this.config.token) {
            throw new Error('Server URL and token are required');
        }

        const cleanServer = this.config.server.replace(/\/$/, '');
        const key = `${cleanServer}\0${this.config.token}`;

        if (
            !refresh &&
            this.hashCache &&
            this.hashCache.key === key &&
            Date.now() - this.hashCache.fetchedAt < TuneCampUploader.CACHE_TTL_MS
        ) {
            return this.hashCache.byHash;
        }

        if (!refresh && this.inflightFetch && this.inflightFetch.key === key) {
            return this.inflightFetch.promise;
        }

        const fetchPromise = (async () => {
            const headers = { Authorization: `Bearer ${this.config.token}` };
            const response = await fetch(`${cleanServer}/api/tracks`, { headers });
            if (!response.ok) {
                throw new Error(`Failed to fetch server tracks: ${response.status}`);
            }
            const payload: any = await response.json();
            const tracks: any[] = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.tracks)
                    ? payload.tracks
                    : [];

            // TuneCamp's default /api/tracks caps results at 5000; also fetch user's own tracks best-effort.
            if (tracks.length >= 5000) {
                try {
                    const mineRes = await fetch(`${cleanServer}/api/tracks?mine=true`, { headers });
                    if (mineRes.ok) {
                        const minePayload: any = await mineRes.json();
                        const mineTracks: any[] = Array.isArray(minePayload)
                            ? minePayload
                            : Array.isArray(minePayload?.tracks)
                                ? minePayload.tracks
                                : [];
                        tracks.push(...mineTracks);
                    }
                } catch {
                    // Best-effort supplement only.
                }
            }

            const byHash = new Map<string, ServerTrackSummary>();
            for (const t of tracks) {
                if (!t || typeof t !== 'object') continue;
                const candidates = [t.hash, t.file_hash];
                for (const raw of candidates) {
                    if (typeof raw !== 'string') continue;
                    const normalized = raw.trim().toLowerCase();
                    if (!normalized || byHash.has(normalized)) continue;
                    byHash.set(normalized, {
                        id: t.id,
                        title: t.title || t.filename || 'Untitled',
                        artist: t.artistName || t.artist_name || undefined,
                        album: t.albumName || t.album_title || undefined,
                        hash: normalized,
                    });
                }
            }

            const currentKey = `${this.config.server.replace(/\/$/, '')}\0${this.config.token}`;
            if (currentKey === key) {
                this.hashCache = { key, fetchedAt: Date.now(), byHash };
            }
            return byHash;
        })();

        this.inflightFetch = { key, promise: fetchPromise };
        try {
            return await fetchPromise;
        } finally {
            if (this.inflightFetch?.promise === fetchPromise) {
                this.inflightFetch = null;
            }
        }
    }

    /**
     * Checks whether a local file already exists on the TuneCamp server by hash.
     */
    public async checkFileExists(
        filePath: string,
        options?: { refresh?: boolean },
    ): Promise<DuplicateCheckResult> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const [rawHash, byHash] = await Promise.all([
            getFastFileHash(filePath),
            this.getServerHashMap(options?.refresh),
        ]);
        const hash = rawHash.toLowerCase();
        const match = byHash.get(hash);
        return {
            exists: Boolean(match),
            hash,
            match,
        };
    }

    /**
     * Checks multiple local files against the server hash index in a single server fetch.
     */
    public async checkFilesExist(
        filePaths: string[],
        options?: { refresh?: boolean },
    ): Promise<Record<string, DuplicateCheckResult>> {
        if (filePaths.length === 0) return {};
        const byHash = await this.getServerHashMap(options?.refresh);
        const results: Record<string, DuplicateCheckResult> = {};
        const CONCURRENCY = 6;

        for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
            const batch = filePaths.slice(i, i + CONCURRENCY);
            await Promise.all(
                batch.map(async (fp) => {
                    try {
                        if (!fs.existsSync(fp)) return;
                        const hash = (await getFastFileHash(fp)).toLowerCase();
                        const match = byHash.get(hash);
                        results[fp] = {
                            exists: Boolean(match),
                            hash,
                            match,
                        };
                    } catch {
                        // Skip individual unreadable files without aborting the batch.
                    }
                }),
            );
        }

        return results;
    }

    /**
     * Uploads a local file to TuneCamp via /api/admin/upload/tracks after verifying
     * it is not already present on the server by content hash (unless force is true).
     */
    public async uploadTrack(filePath: string, metadata?: UploadMetadata): Promise<UploadResult> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        if (!this.config.server || !this.config.token) {
            throw new Error('Server URL and token are required');
        }

        const hash = (await getFastFileHash(filePath)).toLowerCase();

        if (!metadata?.force) {
            const byHash = await this.getServerHashMap();
            const existing = byHash.get(hash);
            if (existing) {
                return {
                    skipped: true,
                    duplicate: true,
                    hash,
                    existingTrack: existing,
                    message: `Already on server: ${existing.artist ? `${existing.artist} - ` : ''}${existing.title}`,
                };
            }
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

        const cleanServer = this.config.server.replace(/\/$/, '');
        const uploadUrl = `${cleanServer}/api/admin/upload/tracks`;

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData as any,
                headers: {
                    Authorization: `Bearer ${this.config.token}`,
                },
            });

            if (!response.ok) {
                let errorData: any = '';
                try {
                    errorData = await response.json();
                } catch {
                    errorData = await response.text();
                }
                throw new Error(
                    `Upload failed: ${response.status} - ${typeof errorData === 'object' ? JSON.stringify(errorData) : errorData}`,
                );
            }

            const data: any = await response.json();
            const currentKey = `${this.config.server.replace(/\/$/, '')}\0${this.config.token}`;
            if (this.hashCache && this.hashCache.key === currentKey) {
                this.hashCache.byHash.set(hash, {
                    id: data?.results?.[0]?.trackId ?? '',
                    title: metadata?.title || path.basename(filePath),
                    artist: metadata?.artist,
                    album: metadata?.album,
                    hash,
                });
            }

            return {
                ...data,
                skipped: false,
                duplicate: false,
                hash,
            };
        } catch (error: any) {
            throw new Error(error.message || 'Upload failed');
        }
    }
}
