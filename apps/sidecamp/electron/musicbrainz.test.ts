import { describe, it, expect } from 'vitest';
import { topTag, lookupGenre, searchRecordingsMB, cleanQuery } from './musicbrainz';

describe('cleanQuery', () => {
  it('cleans extensions, rip tags, track numbers, and underscores', () => {
    expect(cleanQuery('01. Daft_Punk_-_One_More_Time_(Official_Video)_[1080p].mp3')).toBe('Daft Punk - One More Time');
    expect(cleanQuery('05 - Song Name (Lyrics) [HQ]')).toBe('Song Name');
  });
});

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

describe('searchRecordingsMB', () => {
  it('returns candidate recordings with full metadata', async () => {
    const payload = {
      recordings: [
        {
          id: 'mb-rec-1',
          title: 'One More Time',
          score: 100,
          'artist-credit': [{ name: 'Daft Punk' }],
          releases: [
            {
              title: 'Discovery',
              date: '2001-03-12',
              media: [{ position: 1, track: [{ number: '1' }] }],
              tags: [{ count: 10, name: 'french house' }]
            }
          ],
          tags: [{ count: 5, name: 'house' }],
          length: 320000
        }
      ]
    };
    const fn = async () => ({ json: async () => payload });
    const matches = await searchRecordingsMB('Daft Punk', 'One More Time', fn);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({
      id: 'mb-rec-1',
      title: 'One More Time',
      artist: 'Daft Punk',
      album: 'Discovery',
      year: 2001,
      genre: 'House',
      trackNumber: 1,
      duration: 320,
      score: 100
    });
  });
});

