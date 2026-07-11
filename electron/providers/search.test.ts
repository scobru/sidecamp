import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchBandcamp, searchSoundCloud } from './search';

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

describe('searchSoundCloud', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('should return an empty array on network error', async () => {
        const mockError = new Error('Network failure');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(mockError));

        const result = await searchSoundCloud('test query');

        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith('SoundCloud search error:', expect.any(Error));
    });
});
