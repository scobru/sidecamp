import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchTorrents, searchBandcamp, searchSoundCloud } from './search';

describe('searchTorrents', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should return empty array and log error when PirateBay fetch throws an error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        const results = await searchTorrents('test query');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('apibay.org/q.php?q=test%20query'),
            expect.any(Object)
        );
        expect(consoleSpy).toHaveBeenCalledWith("Torrent search error from PirateBay:", expect.any(Error));
        expect(results).toEqual([]);

        consoleSpy.mockRestore();
    });

    it('should handle error when TuneCamp network fetch throws an error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Mock success for PirateBay to ensure we reach the second fetch
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([])
        });

        // Mock error for TuneCamp network
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error 2'));

        const results = await searchTorrents('test query', 'http://test-server.com', 'test-token');

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenNthCalledWith(2,
            expect.stringContaining('test-server.com/api/peers/search?q=test%20query'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "Authorization": "Bearer test-token"
                })
            })
        );
        expect(consoleSpy).toHaveBeenCalledWith("Torrent search error from TuneCamp network:", expect.any(Error));
        expect(results).toEqual([]);

        consoleSpy.mockRestore();
    });
});
