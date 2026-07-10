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

export async function searchTorrents(query: string, server?: string, token?: string): Promise<any[]> {
    const results: any[] = [];

    // 1. Fetch from apibay.org (PirateBay)
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

    // 2. Fetch from connected Sidecamp peers on the network (via TuneCamp server)
    if (server && token) {
        try {
            const cleanServer = server.replace(/\/$/, '');
            const url = `${cleanServer}/api/peers/search?q=${encodeURIComponent(query)}`;
            const res = await fetch(url, {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const peerTracks = await res.json() as any[];
                if (Array.isArray(peerTracks)) {
                    // Filter peer tracks that have a magnet_uri
                    const peerTorrents = peerTracks
                        .filter(track => track.magnet_uri)
                        .map(track => ({
                            id: 'peer_torrent_' + track.id + '_' + track.session_id,
                            title: track.title,
                            artist: track.artist || 'Unknown Artist',
                            album: `Sidecamp Peer: ${track.username || 'Unknown'} (Network)`,
                            url: track.magnet_uri,
                            source: 'torrent_search',
                            size: track.file_size || 0,
                            bitrate: 0,
                            user: `Sidecamp Peer (${track.username})`
                        }));
                    results.push(...peerTorrents);
                }
            }
        } catch (e) {
            console.error("Torrent search error from TuneCamp network:", e);
        }
    }

    return results;
}
