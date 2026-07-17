import { describe, it, expect } from 'vitest';
import { parseGenreFromHtml, lookupGenre } from './beatport';

function page(rows: any[]): string {
  const nd = { props: { pageProps: { dehydratedState: { queries: [{ state: { data: { data: rows } } }] } } } };
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nd)}</script></html>`;
}

describe('parseGenreFromHtml', () => {
  it('extracts first hit genre', () => {
    const html = page([{ genre: [{ genre_name: 'Melodic House & Techno' }] }, { genre: [{ genre_name: 'Trance' }] }]);
    expect(parseGenreFromHtml(html)).toEqual({ genre: 'Melodic House & Techno', status: 'ok' });
  });

  it('no __NEXT_DATA__ → blocked (soft Cloudflare block)', () => {
    expect(parseGenreFromHtml('<html>Attention Required</html>').status).toBe('blocked');
  });

  it('empty result set → noresult', () => {
    expect(parseGenreFromHtml(page([])).status).toBe('noresult');
  });

  it('malformed JSON → badjson', () => {
    expect(parseGenreFromHtml('<script id="__NEXT_DATA__">{oops</script>').status).toBe('badjson');
  });
});

describe('lookupGenre', () => {
  const fetchWith = (bodies: string[]) => {
    const calls: string[] = [];
    const fn = async (url: string) => {
      calls.push(url);
      return { text: async () => bodies[Math.min(calls.length - 1, bodies.length - 1)] };
    };
    return { fn, calls };
  };

  it('returns genre from first query', async () => {
    const { fn, calls } = fetchWith([page([{ genre: [{ genre_name: 'Techno' }] }])]);
    expect(await lookupGenre('X', 'Y', fn)).toBe('Techno');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(encodeURIComponent('X Y'));
  });

  it('falls back to title-only when artist+title misses', async () => {
    const { fn, calls } = fetchWith([page([]), page([{ genre: [{ genre_name: 'House' }] }])]);
    expect(await lookupGenre('LABEL NOISE', 'Real Title', fn, 0)).toBe('House');
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain(encodeURIComponent('Real Title'));
    expect(calls[1]).not.toContain(encodeURIComponent('LABEL NOISE'));
  });

  it('empty query returns null without fetching', async () => {
    const { fn, calls } = fetchWith([page([])]);
    expect(await lookupGenre('', '', fn)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
