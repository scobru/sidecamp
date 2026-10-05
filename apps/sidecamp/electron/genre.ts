// Collapse messy multi-value genre tags ("Minimal, Techno", "House; Tech House; Deep House")
// into ONE clean genre so the library/organizer don't explode into thousands of buckets.
const ALIAS: Record<string, string> = {
  'minimal techno': 'Minimal / Deep Tech',
  'minimal': 'Minimal / Deep Tech',
  'minimal / deep tech': 'Minimal / Deep Tech',
  'minimal house': 'Minimal / Deep Tech',
  'deep tech': 'Minimal / Deep Tech',
  'dnb': 'Drum & Bass',
  'drum and bass': 'Drum & Bass',
  "drum'n'bass": 'Drum & Bass',
  'hip hop': 'Hip-Hop',
  'hiphop': 'Hip-Hop',
  'hip-hop/rap': 'Hip-Hop',
  'electronica': 'Electronic',
  'electronic': 'Electronic',
  'electronica/dance': 'Electronic',
  'tech-house': 'Tech House',
  'deep-house': 'Deep House',
  'prog house': 'Progressive House',
};

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s/-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());

export function normalizeGenre(raw: string | string[] | undefined | null): string {
  const parts = (Array.isArray(raw) ? raw : [raw ?? ''])
    .flatMap((s) => s.split(/[,;|]|\s\/\s/)) // ponytail: first token wins, no scoring by popularity
    .map((s) => s.replace(/^\(\d+\)/, '').trim()) // stray ID3v1 "(17)" prefixes
    .filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0];
  return ALIAS[first.toLowerCase()] ?? titleCase(first);
}
