const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SOUNDCLOUD_URL = "https://soundcloud.com";
const SOUNDCLOUD_API_V2 = "https://api-v2.soundcloud.com";
const CLIENT_ID_REGEX = /[{,]client_id:"(\w+)"/;
const SNDCDN_SCRIPT_URL_REGEX = /https?:\/\/[^\s"]*sndcdn\.com[^\s"]*\.js/g;

let cachedClientId: string | null = null;

async function getSoundCloudClientId(): Promise<string> {
    if (cachedClientId) return cachedClientId;
    try {
        const homeRes = await fetch(SOUNDCLOUD_URL, {
            headers: { "User-Agent": USER_AGENT }
        });
        if (!homeRes.ok) throw new Error(`SC home fetch failed: ${homeRes.status}`);
        const html = await homeRes.text();
        
        const scriptUrls = html.match(SNDCDN_SCRIPT_URL_REGEX) || [];
        
        for (const url of [...scriptUrls].reverse()) {
            try {
                const scriptRes = await fetch(url, {
                    headers: { "User-Agent": USER_AGENT }
                });
                if (!scriptRes.ok) continue;
                const body = await scriptRes.text();
                const match = body.match(CLIENT_ID_REGEX);
                if (match?.[1]) {
                    cachedClientId = match[1];
                    return match[1];
                }
            } catch { /* try next */ }
        }
        throw new Error("Could not find client_id in script assets");
    } catch (err) {
        console.warn("SoundCloud Client ID scrape failed, checking environment variable:", err);
        if (process.env.SOUNDCLOUD_CLIENT_ID) {
            return process.env.SOUNDCLOUD_CLIENT_ID;
        }
        throw new Error("SoundCloud Client ID scrape failed and no SOUNDCLOUD_CLIENT_ID environment variable set");
    }
}

export async function searchSoundCloud(query: string): Promise<any[]> {
    try {
        const clientId = await getSoundCloudClientId();
        const url = `${SOUNDCLOUD_API_V2}/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=10`;
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT }
        });
        if (!res.ok) {
            console.error(`SoundCloud API returned error: ${res.status}`);
            return [];
        }
        const data = (await res.json()) as any;
        const collection = data.collection || [];
        return collection.map((track: any) => ({
            id: 'sc_' + track.id,
            title: track.title,
            artist: track.user?.username || 'Unknown Artist',
            album: '',
            url: track.permalink_url,
            source: 'soundcloud',
            size: 0,
            bitrate: 0,
            user: 'SoundCloud'
        }));
    } catch (e) {
        console.error("SoundCloud search error:", e);
        return [];
    }
}

export async function searchBandcamp(query: string): Promise<any[]> {
    try {
        const response = await fetch("https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT
            },
            body: JSON.stringify({
                search_text: query,
                search_filter: "t", // tracks
                full_page: false,
                fan_id: null
            })
        });
        if (!response.ok) {
            console.error(`Bandcamp Search API returned error: ${response.status}`);
            return [];
        }
        const data = (await response.json()) as any;
        const results = data.auto?.results || [];
        return results.map((r: any) => {
            let trackUrl = r.item_url_path || '';
            if (trackUrl && !trackUrl.startsWith('http') && r.item_url_root) {
                const root = r.item_url_root.replace(/\/$/, '');
                const path = r.item_url_path.replace(/^\//, '');
                trackUrl = `${root}/${path}`;
            } else if (!trackUrl && r.item_url_root) {
                trackUrl = r.item_url_root;
            }
            return {
                id: 'bc_' + r.id,
                title: r.name,
                artist: r.band_name || 'Unknown Artist',
                album: r.album_name || '',
                url: trackUrl,
                source: 'bandcamp',
                size: 0,
                bitrate: 0,
                user: 'Bandcamp'
            };
        });
    } catch (e) {
        console.error("Bandcamp search error:", e);
        return [];
    }
}

// Search free audio on the Internet Archive (archive.org). Each hit resolves to
// a direct file URL, downloaded via yt-dlp's generic extractor like other web URLs.
const ARCHIVE_AUDIO_EXTS = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.opus', '.wma', '.aac'];
function isArchiveAudio(name: string, format?: string): boolean {
    const lower = name.toLowerCase();
    if (ARCHIVE_AUDIO_EXTS.some(ext => lower.endsWith(ext))) return true;
    const fmt = (format || '').toLowerCase();
    return /mp3|flac|ogg|wav|vorbis|audio/.test(fmt);
}

export async function searchArchiveOrg(query: string): Promise<any[]> {
    try {
        const q = `(${query}) AND mediatype:audio`;
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,creator&rows=10&output=json`;
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) { console.error(`Archive.org search error: ${res.status}`); return []; }
        const docs = ((await res.json()) as any)?.response?.docs || [];

        const nested = await Promise.all(docs.map(async (doc: any) => {
            try {
                const fRes = await fetch(`https://archive.org/metadata/${doc.identifier}/files`, {
                    headers: { "User-Agent": USER_AGENT }
                });
                if (!fRes.ok) return [];
                const files = ((await fRes.json()) as any)?.result || [];
                return files
                    .filter((f: any) => f.name && isArchiveAudio(f.name, f.format))
                    .map((f: any) => {
                        const encoded = f.name.split('/').map(encodeURIComponent).join('/');
                        return {
                            id: `archive_${doc.identifier}_${f.name}`,
                            title: f.title || doc.title || f.name,
                            artist: doc.creator || 'Unknown Artist',
                            url: `https://archive.org/download/${doc.identifier}/${encoded}`,
                            source: 'archive',
                            size: parseInt(f.size) || 0,
                            bitrate: 0,
                            user: 'Archive.org'
                        };
                    });
            } catch (e) {
                console.error(`Archive.org files fetch failed for ${doc.identifier}:`, e);
                return [];
            }
        }));
        return nested.flat();
    } catch (e) {
        console.error("Archive.org search error:", e);
        return [];
    }
}

export async function searchTorrents(query: string): Promise<any[]> {
    const results: any[] = [];

    // Fetch from apibay.org (PirateBay)
    try {
        const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT }
        });
        if (res.ok) {
            const data = await res.json() as any[];
            if (Array.isArray(data) && data.length > 0 && data[0].name !== "No results returned") {
                const pbResults = data.slice(0, 10).map((item: any) => {
                    const magnet = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}`;
                    return {
                        id: 'torrent_' + item.id,
                        title: item.name,
                        artist: 'Torrent',
                        album: `Seeds: ${item.seeders} / Peers: ${item.leechers}`,
                        url: magnet,
                        source: 'torrent_search',
                        size: parseInt(item.size) || 0,
                        bitrate: 0,
                        user: 'Torrent (PirateBay)'
                    };
                });
                results.push(...pbResults);
            }
        }
    } catch (e) {
        console.error("Torrent search error from PirateBay:", e);
    }

    return results;
}

// Search audio shared by connected Sidecamp peers on the TuneCamp network.
// Every match is downloadable via the server tunnel (downloadPeerTrack), so we
// no longer drop tracks that lack a magnet_uri.
// /api/search/global only fans out to peer-daemon shares of federated instances,
// never their actual catalogs — so a track just uploaded to another instance
// (not P2P-shared) never showed up here. /api/community/sites and
// /api/catalog/full are both public/unauthenticated, so we fan out to them
// directly and filter client-side (the catalog endpoint has no ?q= of its own).
const FEDERATED_SEARCH_TIMEOUT_MS = 3000;
const FEDERATED_SITE_LIMIT = 8;
const FEDERATED_RESULTS_PER_SITE = 20;

async function searchFederatedInstances(query: string, server: string): Promise<any[]> {
    const q = query.toLowerCase();
    try {
        const cleanServer = server.replace(/\/$/, '');
        const sitesRes = await fetch(`${cleanServer}/api/community/sites`, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(FEDERATED_SEARCH_TIMEOUT_MS)
        });
        if (!sitesRes.ok) return [];
        const sites = await sitesRes.json() as any[];
        const origins = (Array.isArray(sites) ? sites : [])
            .filter(s => s?.url && s.federation !== 'local')
            .slice(0, FEDERATED_SITE_LIMIT);

        const perSite = await Promise.allSettled(origins.map(async (site: any) => {
            const origin = String(site.url).replace(/\/$/, '');
            const res = await fetch(`${origin}/api/catalog/full`, {
                headers: { "User-Agent": USER_AGENT },
                signal: AbortSignal.timeout(FEDERATED_SEARCH_TIMEOUT_MS)
            });
            if (!res.ok) return [];
            const catalog = await res.json() as any;
            const out: any[] = [];
            for (const release of catalog?.releases || []) {
                for (const track of release?.tracks || []) {
                    const title = String(track.title || '');
                    const artist = String(track.artist_name || track.artistName || release.artist_name || '');
                    if (!title.toLowerCase().includes(q) && !artist.toLowerCase().includes(q)) continue;
                    out.push({
                        id: 'instance_' + origin + '_' + track.id,
                        title,
                        artist: artist || 'Unknown Artist',
                        album: release.title || 'Unknown Album',
                        url: '',
                        source: 'instance',
                        origin,
                        trackId: track.id,
                        user: `Instance (${site.name || origin})`
                    });
                    if (out.length >= FEDERATED_RESULTS_PER_SITE) break;
                }
                if (out.length >= FEDERATED_RESULTS_PER_SITE) break;
            }
            return out;
        }));

        const results: any[] = [];
        for (const r of perSite) if (r.status === 'fulfilled') results.push(...r.value);
        return results;
    } catch (e) {
        console.error("Federated instance search error:", e);
        return [];
    }
}

export async function searchPeerNetwork(query: string, server?: string, token?: string): Promise<any[]> {
    if (!server || !token) return [];

    const federatedPromise = searchFederatedInstances(query, server);
    const results: any[] = [];

    try {
        const cleanServer = server.replace(/\/$/, '');
        const url = `${cleanServer}/api/search/global?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Authorization": `Bearer ${token}`
            }
        });
        if (!res.ok) {
            console.error(`Peer network search returned error: ${res.status}`);
            results.push(...await federatedPromise);
            return results;
        }

        const data = await res.json() as any;

        // 1. Map local catalog results (TuneCamp instance files, filtered by permissions)
        if (Array.isArray(data.local)) {
            const localTracks = data.local.map((track: any) => ({
                id: 'catalog_' + track.id,
                title: track.title,
                artist: track.artist || 'Unknown Artist',
                album: track.album || `Catalog: ${cleanServer}`,
                url: '',
                source: 'catalog',
                trackId: track.id,
                size: track.file_size || 0,
                bitrate: track.bitrate || 0,
                user: `Catalog (${track.visibility || 'Public'})`
            }));
            results.push(...localTracks);
        }

        // 2. Map P2P peer results (from connected sidecamp clients & federated peers)
        if (Array.isArray(data.peers)) {
            const peerTracks = data.peers.map((track: any) => ({
                id: 'peer_' + track.session_id + '_' + track.id,
                title: track.title,
                artist: track.artist || 'Unknown Artist',
                album: track.album || `Network: ${track.username || 'Unknown'}`,
                url: '',
                source: 'peer',
                sessionId: track.session_id,
                trackId: track.id,
                origin: track.origin, // passed for federated peer streams
                size: track.file_size || 0,
                bitrate: track.bitrate || 0,
                user: track.origin ? `Federated Peer` : `Network (${track.username || 'Unknown'})`
            }));
            results.push(...peerTracks);
        }

        results.push(...await federatedPromise);
        return results;
    } catch (e) {
        console.error("Peer network search error:", e);
        results.push(...await federatedPromise);
        return results;
    }
}
