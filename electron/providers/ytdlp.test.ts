import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YtdlpService } from './ytdlp';
import child_process from 'child_process';
import path from 'path';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    return {
        ...actual,
        default: {
            ...actual,
            execFile: vi.fn(),
        },
        execFile: vi.fn(),
    };
});

describe('YtdlpService', () => {
    let service: YtdlpService;
    const downloadDir = '/test/downloads';

    beforeEach(() => {
        vi.clearAllMocks();
        service = new YtdlpService(downloadDir);
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
            'yt-dlp',
            [
                '-x',
                '--audio-format',
                'mp3',
                '--user-agent',
                'curl/8.9.1',
                '-o',
                path.join(downloadDir, '%(title)s.%(ext)s'),
                '--',
                validUrl
            ],
            expect.any(Function)
        );
    });
});
