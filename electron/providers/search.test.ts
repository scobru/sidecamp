import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchBandcamp, searchTorrents } from './search';

describe('searchTorrents', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('should return an empty array on network error', async () => {
        const mockError = new Error('Network failure');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(mockError));

        const result = await searchTorrents('test query');

        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Torrent search error:', mockError);
    });

    it('should return an empty array on non-ok response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 500
        }));

        const result = await searchTorrents('test query');

        // Note: The original code doesn't explicitly throw or log for non-ok responses from PirateBay (it just returns the empty array initialized at the beginning of the function and does not enter the res.ok block).
        expect(result).toEqual([]);
    });
});

describe('searchBandcamp', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('should return an empty array on network error', async () => {
        const mockError = new Error('Network failure');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(mockError));

        const result = await searchBandcamp('test query');

        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Bandcamp search error:', mockError);
    });

    it('should return an empty array on non-ok response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 500
        }));

        const result = await searchBandcamp('test query');

        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Bandcamp Search API returned error: 500');
    });
});
