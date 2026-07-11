// Beatport genre lookup. No free public API and api.beatport.com is
// Cloudflare-protected, but the public search page embeds the full result set
// as JSON in <script id="__NEXT_DATA__">. First hit's genre_name is right the
// vast majority of the time (Beatport ranks by relevance).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

export type LookupStatus = 'ok' | 'noresult' | 'blocked' | 'badjson';

export function parseGenreFromHtml(html: string): { genre: string | null; status: LookupStatus } {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { genre: null, status: 'blocked' };
  let nd: any;
  try { nd = JSON.parse(m[1]); } catch { return { genre: null, status: 'badjson' }; }
  const queries = nd?.props?.pageProps?.dehydratedState?.queries ?? [];
  for (const q of queries) {
    const data = q?.state?.data;
    const rows = data && typeof data === 'object' ? data.data : null;
    if (Array.isArray(rows) && rows.length && 'genre' in rows[0]) {
      const g = rows[0].genre?.[0]?.genre_name;
      return g ? { genre: g, status: 'ok' } : { genre: null, status: 'noresult' };
    }
  }
  return { genre: null, status: 'noresult' };
}

type Fetch = (url: string, init?: any) => Promise<{ text(): Promise<string> }>;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function searchOnce(query: string, fetchFn: Fetch): Promise<{ genre: string | null; status: LookupStatus }> {
  try {
    const url = 'https://www.beatport.com/search/tracks?q=' + encodeURIComponent(query.slice(0, 150));
    const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
    return parseGenreFromHtml(await res.text());
  } catch {
    return { genre: null, status: 'blocked' };
  }
}

/**
 * Best-effort genre for artist+title. Backs off once on a soft Cloudflare
 * block, then retries title-only (artist tags are often label/uploader noise).
 */
export async function lookupGenre(artist: string, title: string, fetchFn: Fetch, delayMs = 1400): Promise<string | null> {
  const query = `${artist} ${title}`.trim();
  if (!query) return null;
  let r = await searchOnce(query, fetchFn);
  if (r.status === 'blocked') {
    await sleep(8000);
    r = await searchOnce(query, fetchFn);
  }
  if (!r.genre && artist && title) {
    await sleep(delayMs);
    r = await searchOnce(title, fetchFn);
  }
  return r.genre;
}
