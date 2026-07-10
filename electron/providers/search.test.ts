import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchSoundCloud } from './search';

describe('searchSoundCloud', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('returns empty array when fetch throws an error', async () => {
        // Mock global.fetch to throw an error for the search tracks API, but resolve for scraping client id
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('api-v2.soundcloud.com/search/tracks')) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(''), // dummy html
                json: () => Promise.resolve({}),
            });
        });

        // Suppress console.error for the test output
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        // Also suppress console.warn which happens when scrape fails
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const results = await searchSoundCloud('test query');

        expect(results).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith('SoundCloud search error:', expect.any(Error));
    });
});
