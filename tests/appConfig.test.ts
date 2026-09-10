import { describe, it, expect } from 'vitest';
import { slugify } from '../src/appConfig';

describe('slugify', () => {
  it('lowercases and hyphenates a display name', () => {
    expect(slugify('Digital Flower Vase')).toBe('digital-flower-vase');
  });

  it('collapses runs of punctuation and whitespace into one hyphen', () => {
    expect(slugify("Rama's  Vase — 2026!")).toBe('rama-s-vase-2026');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  ...Bouquet...  ')).toBe('bouquet');
  });

  it('keeps accented letters as their base letter instead of dropping them', () => {
    expect(slugify('Café Blooms')).toBe('cafe-blooms');
  });

  it('falls back when a name leaves no usable characters', () => {
    // An empty stem would download as a dotfile (".png"), so it must not happen.
    expect(slugify('!!!')).toBe('flower-vase');
    expect(slugify('')).toBe('flower-vase');
    expect(slugify('花瓶')).toBe('flower-vase');
  });
});
