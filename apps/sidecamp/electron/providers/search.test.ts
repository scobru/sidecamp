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

    it('should return an empty array if json parsing fails', async () => {
        const mockError = new Error('JSON parsing error');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockRejectedValue(mockError)
        }));

        const result = await searchBandcamp('test query');

        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Bandcamp search error:', mockError);
    });

    it('should map successful results correctly with absolute urls', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                auto: {
                    results: [
                        {
                            id: 1,
                            name: 'Test Song',
                            band_name: 'Test Band',
                            album_name: 'Test Album',
                            item_url_path: 'https://testband.bandcamp.com/track/test-song'
                        }
                    ]
                }
            })
        }));

        const result = await searchBandcamp('test query');

        expect(result).toEqual([
            {
                id: 'bc_1',
                title: 'Test Song',
                artist: 'Test Band',
                album: 'Test Album',
                url: 'https://testband.bandcamp.com/track/test-song',
                source: 'bandcamp',
                size: 0,
                bitrate: 0,
                user: 'Bandcamp'
            }
        ]);
    });

    it('should map successful results with relative item_url_path and item_url_root', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                auto: {
                    results: [
                        {
                            id: 2,
                            name: 'Test Song 2',
                            band_name: 'Test Band 2',
                            album_name: 'Test Album 2',
                            item_url_root: 'https://testband2.bandcamp.com/',
                            item_url_path: '/track/test-song-2'
                        }
                    ]
                }
            })
        }));

        const result = await searchBandcamp('test query');

        expect(result).toEqual([
            {
                id: 'bc_2',
                title: 'Test Song 2',
                artist: 'Test Band 2',
                album: 'Test Album 2',
                url: 'https://testband2.bandcamp.com/track/test-song-2',
                source: 'bandcamp',
                size: 0,
                bitrate: 0,
                user: 'Bandcamp'
            }
        ]);
    });

    it('should map successful results when track url is missing but root exists', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                auto: {
                    results: [
                        {
                            id: 3,
                            name: 'Test Song 3',
                            item_url_root: 'https://testband3.bandcamp.com'
                        }
                    ]
                }
            })
        }));

        const result = await searchBandcamp('test query');

        expect(result).toEqual([
            {
                id: 'bc_3',
                title: 'Test Song 3',
                artist: 'Unknown Artist',
                album: '',
                url: 'https://testband3.bandcamp.com',
                source: 'bandcamp',
                size: 0,
                bitrate: 0,
                user: 'Bandcamp'
            }
        ]);
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
