import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchBandcamp, searchPeerNetwork, searchSoundCloud } from './search';

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

describe('searchPeerNetwork — catalog results', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    /** Routes the two calls searchPeerNetwork makes: community sites, then global search. */
    const stubServer = (globalPayload: any) => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (String(url).includes('/api/community/sites')) {
                return { ok: true, json: async () => [] };
            }
            return { ok: true, json: async () => globalPayload };
        }));
    };

    // /api/search/global answers `local` as { artists, albums, tracks } — the
    // shape TuneCamp's own webapp reads. Sidecamp tested it with Array.isArray,
    // so the catalog source silently returned nothing.
    it('reads catalog tracks out of the object shape the server actually sends', async () => {
        stubServer({
            local: {
                artists: [],
                albums: [],
                tracks: [
                    {
                        id: 7,
                        title: 'Amorevole Crollo',
                        artist_name: 'Scobru',
                        album_title: 'Orphan Release',
                        album_visibility: 'public',
                        file_size: 1234,
                        bitrate: 320,
                    },
                ],
            },
            peers: [],
        });

        const results = await searchPeerNetwork('amorevole', 'https://tc.example.com', 'tok');

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            id: 'catalog_7',
            title: 'Amorevole Crollo',
            artist: 'Scobru',
            album: 'Orphan Release',
            source: 'catalog',
            trackId: 7,
            size: 1234,
            bitrate: 320,
            user: 'Catalog (public)',
        });
    });

    it('carries the release distribution mode through for the download policy', async () => {
        stubServer({
            local: {
                tracks: [
                    {
                        id: 8,
                        title: 'Sold',
                        artist_name: 'Scobru',
                        album_download: 'codes',
                        album_price: 5,
                        price: 0,
                    },
                ],
            },
            peers: [],
        });

        const results = await searchPeerNetwork('sold', 'https://tc.example.com', 'tok');

        expect(results[0]).toMatchObject({
            releaseDownload: 'codes',
            releasePrice: 5,
        });
    });

    it('still accepts a flat array, in case a server sends one', async () => {
        stubServer({
            local: [{ id: 9, title: 'Flat', artist: 'Legacy', album: 'Old Shape' }],
            peers: [],
        });

        const results = await searchPeerNetwork('flat', 'https://tc.example.com', 'tok');

        expect(results[0]).toMatchObject({ id: 'catalog_9', artist: 'Legacy', album: 'Old Shape' });
    });

    it('falls back to sane labels when the row names nothing', async () => {
        stubServer({ local: { tracks: [{ id: 10, title: 'Bare' }] }, peers: [] });

        const results = await searchPeerNetwork('bare', 'https://tc.example.com/', 'tok');

        expect(results[0]).toMatchObject({
            artist: 'Unknown Artist',
            album: 'Catalog: https://tc.example.com',
            user: 'Catalog (Public)',
        });
    });

    it('returns no catalog results when the server sends none', async () => {
        stubServer({ local: { artists: [], albums: [], tracks: [] }, peers: [] });

        expect(await searchPeerNetwork('nothing', 'https://tc.example.com', 'tok')).toEqual([]);
    });

    it('carries a peer share\'s allow_download flag through', async () => {
        stubServer({
            local: { tracks: [] },
            peers: [
                { id: 'p1', session_id: 's1', title: 'Shared', artist: 'DJ', allow_download: false },
            ],
        });

        const results = await searchPeerNetwork('shared', 'https://tc.example.com', 'tok');

        expect(results[0]).toMatchObject({ source: 'peer', allowDownload: false });
    });
});
