import { describe, it, expect } from 'vitest';
import { topTag, lookupGenre } from './musicbrainz';

describe('topTag', () => {
  it('picks highest-voted tag, Title-cased', () => {
    expect(topTag([{ count: 1, name: 'pop' }, { count: 5, name: 'hard rock' }])).toBe('Hard Rock');
  });
  it('empty / missing → null', () => {
    expect(topTag([])).toBeNull();
    expect(topTag(undefined)).toBeNull();
  });
});

describe('lookupGenre', () => {
  const fetchWith = (payload: any) => {
    const calls: string[] = [];
    const fn = async (url: string) => { calls.push(url); return { json: async () => payload }; };
    return { fn, calls };
  };

  it('returns top tag of first recording', async () => {
    const { fn, calls } = fetchWith({ recordings: [{ tags: [{ count: 3, name: 'jazz' }, { count: 1, name: 'blues' }] }] });
    expect(await lookupGenre('Miles Davis', 'So What', fn)).toBe('Jazz');
    expect(calls[0]).toContain(encodeURIComponent('recording:"So What"'));
    expect(calls[0]).toContain(encodeURIComponent('artist:"Miles Davis"'));
  });

  it('no tags → null', async () => {
    const { fn } = fetchWith({ recordings: [{}] });
    expect(await lookupGenre('X', 'Y', fn)).toBeNull();
  });

  it('empty title → null without fetching', async () => {
    const { fn, calls } = fetchWith({});
    expect(await lookupGenre('X', '', fn)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('fetch throws → null', async () => {
    const fn = async () => { throw new Error('network'); };
    expect(await lookupGenre('X', 'Y', fn)).toBeNull();
  });
});
