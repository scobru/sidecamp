import { describe, it, expect } from 'vitest';
import { parseGenreFromHtml, parseTracksFromHtml, lookupGenre, searchTracksBeatport } from './beatport';

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

describe('parseTracksFromHtml', () => {
  it('extracts tracks with bpm, key, genre, album, and artist', () => {
    const rawRows = [
      {
        id: 12345,
        name: 'Rumble',
        mix_name: 'Original Mix',
        artists: [{ name: 'Skrillex' }, { name: 'Fred again..' }, { name: 'Flowdan' }],
        release: { name: 'Quest For Fire', publish_date: '2023-02-17' },
        genre: [{ genre_name: 'UK Bass' }],
        bpm: 140,
        key: { name: '4m' }
      }
    ];
    const { tracks, status } = parseTracksFromHtml(page(rawRows));
    expect(status).toBe('ok');
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toEqual({
      id: 12345,
      title: 'Rumble',
      artist: 'Skrillex, Fred again.., Flowdan',
      album: 'Quest For Fire',
      genre: 'UK Bass',
      bpm: 140,
      key: '4m',
      year: 2023,
      label: null,
      artwork: null,
      sampleUrl: null
    });
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
  });

  it('empty query returns null without fetching', async () => {
    const { fn, calls } = fetchWith([page([])]);
    expect(await lookupGenre('', '', fn)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('searchTracksBeatport', () => {
  it('searches and returns candidate tracks', async () => {
    const rawRows = [
      {
        id: 999,
        name: 'Strobe',
        mix_name: 'Club Mix',
        artists: [{ name: 'deadmau5' }],
        release: { name: 'For Lack of a Better Name' },
        genre: [{ genre_name: 'Progressive House' }],
        bpm: 128,
        key: { name: '8B' }
      }
    ];
    const fn = async () => ({ text: async () => page(rawRows) });
    const tracks = await searchTracksBeatport('deadmau5', 'Strobe', fn);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].title).toBe('Strobe (Club Mix)');
    expect(tracks[0].artist).toBe('deadmau5');
    expect(tracks[0].bpm).toBe(128);
    expect(tracks[0].key).toBe('8B');
  });
});

