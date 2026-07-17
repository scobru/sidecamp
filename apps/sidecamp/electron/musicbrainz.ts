// MusicBrainz genre lookup — fallback for the non-electronic tracks Beatport
// can't classify (Beatport's catalog is electronic/DJ only). Free API, no key;
// policy requires a descriptive User-Agent and <=1 req/sec (the fill loop's
// 1.4s sleep already satisfies the rate limit).

const UA = 'Sidecamp/0.2 ( https://github.com/scobru/sidecamp )';

type Fetch = (url: string, init?: any) => Promise<{ json(): Promise<any> }>;

// MusicBrainz tags are lowercase folksonomy ("hard rock"); Title-case them to
// match Beatport's genre style ("Hard Rock").
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
  const t = title.trim();
  if (!t) return null;
  const query = artist.trim()
    ? `recording:"${t}" AND artist:"${artist.trim()}"`
    : `recording:"${t}"`;
  const url = 'https://musicbrainz.org/ws/2/recording?fmt=json&limit=1&query=' + encodeURIComponent(query);
  try {
    const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    // ponytail: recording-level tags only (sparse). If coverage disappoints,
    // add a second fetch of the recording's release-group genres (richer, +1 req/track).
    return topTag(data?.recordings?.[0]?.tags);
  } catch {
    return null;
  }
}
