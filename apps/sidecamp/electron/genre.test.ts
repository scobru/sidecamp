import { describe, it, expect } from 'vitest';
import { normalizeGenre } from './genre';

describe('normalizeGenre', () => {
  it('keeps first of multi-value', () => {
    expect(normalizeGenre('House, Techno, Tech House')).toBe('House');
    expect(normalizeGenre(['Techno; Minimal'])).toBe('Techno');
  });
  it('folds minimal variants', () => {
    expect(normalizeGenre('Minimal, Techno')).toBe('Minimal / Deep Tech');
    expect(normalizeGenre('minimal house')).toBe('Minimal / Deep Tech');
  });
  it('title-cases, keeps ampersand genres, handles empty', () => {
    expect(normalizeGenre('melodic house & techno')).toBe('Melodic House & Techno');
    expect(normalizeGenre('')).toBe('');
    expect(normalizeGenre(undefined)).toBe('');
  });
});
