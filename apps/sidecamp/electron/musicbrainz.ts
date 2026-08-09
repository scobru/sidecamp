// MusicBrainz search and genre lookup. Free API, no key;
// policy requires a descriptive User-Agent and <=1 req/sec.

const UA = 'Sidecamp/0.2 ( https://github.com/scobru/sidecamp )';

type Fetch = (url: string, init?: any) => Promise<{ json(): Promise<any> }>;

export interface MusicBrainzMatch {
  title: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string | null;
  trackNumber: number | null;
  duration?: number;
  score: number;
  id: string;
}

export function cleanQuery(s: string): string {
  if (!s) return '';
  return s
    .replace(/\.[^/.]+$/, '') // remove file extension
    .replace(/^\d{1,3}[\s._-]+(?=\D)/, '') // remove track number
    .replace(/[\[(](?:official|audio|video|hd|hq|4k|1080p|lyrics|remastered|explicit|clean|320kbps|free\s*download)[^\])]*[\])]/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// MusicBrainz tags are lowercase folksonomy ("hard rock"); Title-case them to
// match standard genre style ("Hard Rock").
function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// Highest-voted tag from a MusicBrainz entity's tag list.
export function topTag(tags: any): string | null {
  if (!Array.isArray(tags) || !tags.length) return null;
  const best = tags.reduce((a, b) => ((b?.count ?? 0) > (a?.count ?? 0) ? b : a));
  return best?.name ? titleCase(best.name) : null;
}

/**
 * Best-effort genre for artist+title via MusicBrainz recording search.
 * Returns the top community tag on the first matching recording, or null.
 */
export async function lookupGenre(artist: string, title: string, fetchFn: Fetch): Promise<string | null> {
  const t = cleanQuery(title);
  const a = cleanQuery(artist);
  if (!t) return null;
  const query = a
    ? `recording:"${t}" AND artist:"${a}"`
    : `recording:"${t}"`;
  const url = 'https://musicbrainz.org/ws/2/recording?fmt=json&limit=1&query=' + encodeURIComponent(query);
  try {
    const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    return topTag(data?.recordings?.[0]?.tags);
  } catch {
    return null;
  }
}

/**
 * Search MusicBrainz for candidate recordings.
 * Returns up to `limit` matches with artist, title, album, year, genre, and score.
 */
export async function searchRecordingsMB(
  artist: string,
  title: string,
  fetchFn: Fetch,
  limit = 8
): Promise<MusicBrainzMatch[]> {
  const t = cleanQuery(title);
  const a = cleanQuery(artist);
  if (!t && !a) return [];

  const queryParts: string[] = [];
  if (t) queryParts.push(`recording:"${t}"`);
  if (a) queryParts.push(`artist:"${a}"`);
  const query = queryParts.length > 1 ? queryParts.join(' AND ') : (t || a);

  const url = `https://musicbrainz.org/ws/2/recording?fmt=json&limit=${limit}&query=` + encodeURIComponent(query);
  try {
    const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    const recordings = Array.isArray(data?.recordings) ? data.recordings : [];

    return recordings.map((r: any): MusicBrainzMatch => {
      let artistStr = '';
      if (Array.isArray(r['artist-credit'])) {
        artistStr = r['artist-credit'].map((ac: any) => (typeof ac === 'string' ? ac : (ac.name || '') + (ac.joinphrase || ''))).join('').trim();
      }
      if (!artistStr && r.artist) artistStr = r.artist;

      const firstRelease = Array.isArray(r.releases) && r.releases.length > 0 ? r.releases[0] : null;
      const album = firstRelease?.title?.trim() || '';
      
      let year: number | null = null;
      if (firstRelease?.date) {
        const y = parseInt(String(firstRelease.date).slice(0, 4), 10);
        if (!isNaN(y) && y > 1900 && y < 2100) year = y;
      }

      let trackNum: number | null = null;
      const media = firstRelease?.media?.[0];
      const trackObj = media?.track?.[0];
      if (trackObj?.number) {
        const n = parseInt(trackObj.number, 10);
        if (!isNaN(n)) trackNum = n;
      } else if (media?.position) {
        trackNum = media.position;
      }

      const genre = topTag(r.tags) || (firstRelease?.tags ? topTag(firstRelease.tags) : null);
      const duration = typeof r.length === 'number' && r.length > 0 ? Math.round(r.length / 1000) : undefined;
      const score = typeof r.score === 'number' ? r.score : parseInt(r.score, 10) || 0;

      return {
        id: r.id || '',
        title: r.title?.trim() || t,
        artist: artistStr || a,
        album,
        year,
        genre,
        trackNumber: trackNum,
        duration,
        score,
      };
    });
  } catch {
    return [];
  }
}

