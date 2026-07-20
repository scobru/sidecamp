import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YtdlpService } from './ytdlp';
import child_process from 'child_process';
import fs from 'fs';
import path from 'path';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    const execFile = vi.fn();
    return {
        ...actual,
        default: { ...actual, execFile },
        execFile,
    };
});

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    const existsSync = vi.fn(() => true);
    return {
        ...actual,
        default: { ...actual, existsSync },
        existsSync,
    };
});

const YTDLP_BINARY_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';

describe('YtdlpService', () => {
    let service: YtdlpService;
    const downloadDir = '/test/downloads';
    const binDir = '/test/bin';
    const binPath = path.join(binDir, YTDLP_BINARY_NAME);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(true);
        service = new YtdlpService(downloadDir, binDir);
    });

    it('should reject invalid URLs to prevent command injection', async () => {
        const invalidUrl = 'not-a-url; rm -rf /';

        await expect(service.download(invalidUrl)).rejects.toThrow('Invalid URL provided');
        expect(child_process.execFile).not.toHaveBeenCalled();
    });

    it('should call execFile with correct arguments for a valid URL', async () => {
        const validUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

        // Mock execFile implementation to immediately call the callback with success
        vi.mocked(child_process.execFile).mockImplementation(((cmd: string, args: string[], cb: Function) => {
            cb(null, 'Destination: /test/downloads/video.mp3', '');
            return {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() }
            };
        }) as any);

        const result = await service.download(validUrl);

        expect(result).toBe('/test/downloads/video.mp3');
        expect(child_process.execFile).toHaveBeenCalledWith(
            binPath,
            [
                '-x',
                '--audio-format',
                'mp3',
                '--user-agent',
                'curl/8.9.1',
                '--ffmpeg-location',
                binDir,
                '-o',
                path.join(downloadDir, '%(title)s.%(ext)s'),
                '--',
                validUrl
            ],
            expect.any(Function)
        );
    });

    it('should return empty array for blank query without calling execFile', async () => {
        const result = await service.search('   ');

        expect(result).toEqual([]);
        expect(child_process.execFile).not.toHaveBeenCalled();
    });

    it('should call execFile with ytsearch pseudo-URL and map entries', async () => {
        const json = JSON.stringify({
            entries: [
                { id: 'abc123', title: 'Test Track', uploader: 'Test Channel', webpage_url: 'https://www.youtube.com/watch?v=abc123' },
                { id: 'def456', title: 'No Uploader Track' }
            ]
        });

        vi.mocked(child_process.execFile).mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
            cb(null, json, '');
            return { stdout: { on: vi.fn() }, stderr: { on: vi.fn() } };
        }) as any);

        const result = await service.search('lofi beats');

        expect(child_process.execFile).toHaveBeenCalledWith(
            binPath,
            ['--flat-playlist', '--dump-single-json', '--no-warnings', 'ytsearch15:lofi beats'],
            expect.any(Object),
            expect.any(Function)
        );
        expect(result).toEqual([
            {
                id: 'yt_abc123',
                title: 'Test Track',
                artist: 'Test Channel',
                album: '',
                url: 'https://www.youtube.com/watch?v=abc123',
                source: 'youtube',
                size: 0,
                bitrate: 0,
                user: 'YouTube'
            },
            {
                id: 'yt_def456',
                title: 'No Uploader Track',
                artist: 'Unknown Artist',
                album: '',
                url: 'https://www.youtube.com/watch?v=def456',
                source: 'youtube',
                size: 0,
                bitrate: 0,
                user: 'YouTube'
            }
        ]);
    });

    it('should return empty array when execFile errors', async () => {
        vi.mocked(child_process.execFile).mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
            cb(new Error('yt-dlp crashed'), '', '');
            return { stdout: { on: vi.fn() }, stderr: { on: vi.fn() } };
        }) as any);

        const result = await service.search('some query');

        expect(result).toEqual([]);
    });

    it('should return empty array on malformed JSON output', async () => {
        vi.mocked(child_process.execFile).mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
            cb(null, 'not json', '');
            return { stdout: { on: vi.fn() }, stderr: { on: vi.fn() } };
        }) as any);

        const result = await service.search('some query');

        expect(result).toEqual([]);
    });
});
