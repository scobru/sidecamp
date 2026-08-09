// Beatport search & genre lookup. No free public API and api.beatport.com is
// Cloudflare-protected, but the public search page embeds the full result set
// as JSON in <script id="__NEXT_DATA__">.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

export type LookupStatus = 'ok' | 'noresult' | 'blocked' | 'badjson';

export interface BeatportMatch {
  title: string;
  artist: string;
  album: string;
  genre: string | null;
  bpm: number | null;
  key: string | null;
  year: number | null;
  label?: string | null;
  artwork?: string | null;
  sampleUrl?: string | null;
  id?: string | number;
}

function cleanQuery(s: string): string {
  if (!s) return '';
  return s
    .replace(/\.[^/.]+$/, '')
    .replace(/^\d{1,3}[\s._-]+(?=\D)/, '')
    .replace(/[\[(](?:official|audio|video|hd|hq|4k|1080p|lyrics|remastered|explicit|clean|320kbps|free\s*download)[^\])]*[\])]/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseGenreFromHtml(html: string): { genre: string | null; status: LookupStatus } {
  const { tracks, status } = parseTracksFromHtml(html);
  if (status !== 'ok') return { genre: null, status };
  return { genre: tracks[0]?.genre || null, status: tracks[0]?.genre ? 'ok' : 'noresult' };
}

export function parseTracksFromHtml(html: string): { tracks: BeatportMatch[]; status: LookupStatus } {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { tracks: [], status: 'blocked' };
  let nd: any;
  try { nd = JSON.parse(m[1]); } catch { return { tracks: [], status: 'badjson' }; }
  const queries = nd?.props?.pageProps?.dehydratedState?.queries ?? [];
  for (const q of queries) {
    const data = q?.state?.data;
    const rows = data && typeof data === 'object' ? data.data : null;
    if (Array.isArray(rows) && rows.length) {
      const tracks: BeatportMatch[] = rows.map((r: any) => {
        let artist = '';
        if (Array.isArray(r.artists) && r.artists.length) {
          artist = r.artists.map((a: any) => a.name || '').filter(Boolean).join(', ');
        } else if (r.artist_name) {
          artist = r.artist_name;
        }

        const baseTitle = r.name || r.track_name || '';
        const mix = r.mix_name || '';
        const title = mix && mix.toLowerCase() !== 'original mix' ? `${baseTitle} (${mix})` : baseTitle;

        const album = r.release?.name || r.release_name || '';
        const genre = r.genre?.[0]?.genre_name || r.genre_name || null;
        
        let bpm: number | null = null;
        if (typeof r.bpm === 'number' && Number.isFinite(r.bpm) && r.bpm > 0) {
          bpm = Math.round(r.bpm * 100) / 100;
        } else if (r.bpm) {
          const b = parseFloat(String(r.bpm));
          if (!isNaN(b)) bpm = Math.round(b * 100) / 100;
        }

        const key = r.key?.name || (typeof r.key === 'string' ? r.key : null) || null;

        let year: number | null = null;
        const dateStr = r.publish_date || r.release_date || r.release?.publish_date;
        if (dateStr) {
          const y = parseInt(String(dateStr).slice(0, 4), 10);
          if (!isNaN(y) && y > 1900 && y < 2100) year = y;
        }

        const label = r.release?.label?.name || r.label?.name || null;
        const artwork = r.release?.image?.uri || r.image?.uri || null;
        const sampleUrl = r.sample_url || null;

        return {
          id: r.id || '',
          title: title || baseTitle,
          artist,
          album,
          genre,
          bpm,
          key,
          year,
          label,
          artwork,
          sampleUrl,
        };
      });

      return { tracks, status: 'ok' };
    }
  }
  return { tracks: [], status: 'noresult' };
}

type Fetch = (url: string, init?: any) => Promise<{ text(): Promise<string> }>;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function searchOnce(query: string, fetchFn: Fetch): Promise<{ tracks: BeatportMatch[]; status: LookupStatus }> {
  try {
    const url = 'https://www.beatport.com/search/tracks?q=' + encodeURIComponent(query.slice(0, 150));
    const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
    return parseTracksFromHtml(await res.text());
  } catch {
    return { tracks: [], status: 'blocked' };
  }
}

/**
 * Search Beatport for candidate tracks matching artist and title.
 */
export async function searchTracksBeatport(
  artist: string,
  title: string,
  fetchFn: Fetch
): Promise<BeatportMatch[]> {
  const t = cleanQuery(title);
  const a = cleanQuery(artist);
  const query = `${a} ${t}`.trim();
  if (!query) return [];

  let r = await searchOnce(query, fetchFn);
  if (r.status === 'blocked') {
    await sleep(2000);
    r = await searchOnce(query, fetchFn);
  }
  if (!r.tracks.length && a && t) {
    await sleep(500);
    r = await searchOnce(t, fetchFn);
  }
  return r.tracks;
}

/**
 * Best-effort genre for artist+title. Backs off once on a soft Cloudflare
 * block, then retries title-only (artist tags are often label/uploader noise).
 */
export async function lookupGenre(artist: string, title: string, fetchFn: Fetch, delayMs = 1400): Promise<string | null> {
  const a = cleanQuery(artist);
  const t = cleanQuery(title);
  const query = `${a} ${t}`.trim();
  if (!query) return null;
  let r = await searchOnce(query, fetchFn);
  if (r.status === 'blocked') {
    await sleep(8000);
    r = await searchOnce(query, fetchFn);
  }
  if (!r.tracks.length && a && t) {
    await sleep(delayMs);
    r = await searchOnce(t, fetchFn);
  }
  return r.tracks[0]?.genre || null;
}

