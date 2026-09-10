/**
 * Share-codec tests.
 *
 * Two things matter here and nothing else does: a link must survive a round trip
 * unchanged (within the codec's declared quantisation), and a corrupt or outdated
 * link must degrade rather than throw. Share links are the feature the user
 * actually hands to another person, so failures are visible and embarrassing.
 */
import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import '../src/catalog';
import { allFlowerTypes, allVaseTypes } from '../src/catalog/registry';
import {
  SHARE_HASH_PREFIX,
  buildShareUrl,
  decodeShare,
  encodeShare,
  readShareFromHash,
} from '../src/lib/share';
import { LIMITS, TEXT_DEFAULTS, makeFlower, normalizeDoc } from '../src/lib/normalize';
import { TEXT_PLACEMENTS, type Doc, type Flower } from '../src/types';

/** Matches SAFE_URL_LENGTH in ui/Toolbar.tsx. */
const SAFE_URL_LENGTH = 2000;

const types = allFlowerTypes();
const vases = allVaseTypes();

/**
 * Assert a value survived quantisation to `step`. Max error is half a step; the
 * epsilon covers binary float representation on top of that (|−7.6 − −7.65|
 * evaluates to 0.05000000000000071, not 0.05).
 */
function withinStep(actual: number, expected: number, step: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(step / 2 + 1e-9);
}

/**
 * Build a document with DETERMINISTIC seeds.
 *
 * `makeFlower` assigns a random seed, and seeds are the least compressible part
 * of the payload, so leaving them random makes every size assertion below vary
 * run to run. That is not hypothetical: with random seeds, a 40-flower link
 * measured 1953–2006 characters across 500 samples and exceeded the 2000-char
 * budget about 1.8% of the time — a test that fails once or twice in a hundred
 * CI runs for no reason anyone can reproduce locally. Fixing the seeds makes
 * the size tests mean something.
 */
function docWith(count: number): Doc {
  const flowers: Flower[] = [];
  for (let i = 0; i < count; i += 1) {
    const type = types[i % types.length]!;
    const f = makeFlower(type.id, ((i * 7) % 20) / 20, 0.1 + ((i * 3) % 16) / 20);
    if (f) flowers.push({ ...f, seed: (i * 2654435761) >>> 0 });
  }
  return {
    v: 1,
    theme: 'dark',
    vase: {
      shapeId: vases[2]!.id,
      material: 'glass',
      pattern: 'dots',
      color: '#a8bcc9',
      accent: '#3f4a52',
      height: 1.18,
      width: 0.92,
    },
    flowers,
    text: TEXT_DEFAULTS,
  };
}

describe('encode / decode', () => {
  it('round-trips the vase exactly', () => {
    const doc = docWith(6);
    const result = decodeShare(encodeShare(doc));
    expect(result).not.toBeNull();
    expect(result!.dropped).toBe(0);
    expect(result!.doc.vase).toEqual(doc.vase);
    expect(result!.doc.theme).toBe('dark');
  });

  it('round-trips every flower within the codec quantisation', () => {
    const doc = docWith(12);
    const result = decodeShare(encodeShare(doc))!;
    expect(result.doc.flowers).toHaveLength(doc.flowers.length);

    doc.flowers.forEach((original, i) => {
      const decoded = result.doc.flowers[i]!;
      expect(decoded.typeId).toBe(original.typeId);
      expect(decoded.seed).toBe(original.seed);
      expect(decoded.colors).toEqual(original.colors);
      expect(decoded.z).toBe(original.z);
      // Quantisation steps declared by the codec.
      withinStep(decoded.u, original.u, 0.001);
      withinStep(decoded.depth, original.depth, 0.001);
      withinStep(decoded.lean, original.lean, 0.1);
      withinStep(decoded.size, original.size, 0.01);
      withinStep(decoded.stemLength, original.stemLength, 0.01);
    });
  });

  it('keeps a full 40-flower arrangement inside the safe URL length', () => {
    const url = buildShareUrl(docWith(LIMITS.hardCap), 'https://example.com/flower-vase/');
    expect(url.length).toBeLessThan(SAFE_URL_LENGTH);
  });

  it('preserves a manual z-order override', () => {
    const doc = docWith(2);
    doc.flowers[0]!.z = 0.421;
    const result = decodeShare(encodeShare(doc))!;
    expect(result.doc.flowers[0]!.z).toBeCloseTo(0.421, 3);
    expect(result.doc.flowers[1]!.z).toBeNull();
  });
});

describe('resilience', () => {
  it('drops flowers whose type no longer exists, keeping the rest', () => {
    const doc = docWith(3);
    // Simulate a type that was removed from the catalog after the link was made.
    doc.flowers[1]!.typeId = 'no-such-flower';
    const result = decodeShare(encodeShare(doc))!;
    expect(result.doc.flowers).toHaveLength(2);
    expect(result.dropped).toBe(1);
  });

  it('falls back to a registered vase when the shape is unknown', () => {
    const doc = docWith(1);
    doc.vase.shapeId = 'no-such-vase';
    const result = decodeShare(encodeShare(doc))!;
    expect(vases.map((v) => v.id)).toContain(result.doc.vase.shapeId);
  });

  it.each(['', 'not-compressed', 'AAAA', '%%%', 'null', 'W10='])(
    'returns null for the unusable payload %j',
    (payload) => {
      expect(decodeShare(payload)).toBeNull();
    },
  );

  it('ignores a hash that is not a share link', () => {
    expect(readShareFromHash('')).toBeNull();
    expect(readShareFromHash('#')).toBeNull();
    expect(readShareFromHash('#section-2')).toBeNull();
  });

  it('reads a share link back out of a hash', () => {
    const doc = docWith(4);
    const url = buildShareUrl(doc, 'https://example.com/app/?x=1#old-hash');
    expect(url.startsWith(`https://example.com/app/?x=1${SHARE_HASH_PREFIX}`)).toBe(true);
    const result = readShareFromHash(url.slice(url.indexOf('#')));
    expect(result!.doc.flowers).toHaveLength(4);
  });

  it('produces documents that are already normalised', () => {
    const doc = docWith(5);
    const decoded = decodeShare(encodeShare(doc))!.doc;
    // Re-normalising a decoded document must be a no-op, otherwise the codec is
    // emitting values the rest of the app would silently repair.
    expect(normalizeDoc(decoded).doc).toEqual(decoded);
  });
});

describe('note', () => {
  const withNote = (over: Partial<Doc['text']> = {}): Doc => ({
    ...docWith(3),
    text: { ...TEXT_DEFAULTS, content: 'Happy birthday', ...over },
  });

  it('round-trips a note through a share link', () => {
    const doc = withNote({ placement: 'tag', font: 'script', color: '#8d2050', size: 1.4 });
    const decoded = decodeShare(encodeShare(doc))!.doc;
    expect(decoded.text.content).toBe('Happy birthday');
    expect(decoded.text.placement).toBe('tag');
    expect(decoded.text.font).toBe('script');
    expect(decoded.text.color).toBe('#8d2050');
    withinStep(decoded.text.size, 1.4, 0.01);
  });

  it('round-trips every placement', () => {
    for (const placement of TEXT_PLACEMENTS) {
      const decoded = decodeShare(encodeShare(withNote({ placement })))!.doc;
      expect(decoded.text.placement).toBe(placement);
    }
  });

  it('preserves newlines in a multi-line note', () => {
    const decoded = decodeShare(encodeShare(withNote({ content: 'With love,\nRamadas' })))!.doc;
    expect(decoded.text.content).toBe('With love,\nRamadas');
  });

  it('omits the note from the payload when empty, keeping links short', () => {
    const bare = docWith(3);
    const withEmpty = { ...bare, text: { ...TEXT_DEFAULTS, content: '' } };
    // An empty note must not cost link budget.
    expect(encodeShare(withEmpty)).toBe(encodeShare(bare));
  });

  it('decodes a legacy 4-element payload written before notes existed', () => {
    // Simulates a link shared by an older build: no 5th element at all.
    const legacy = JSON.parse(
      LZString.decompressFromEncodedURIComponent(encodeShare(docWith(2)))!,
    );
    expect(legacy).toHaveLength(4);
    const decoded = decodeShare(
      LZString.compressToEncodedURIComponent(JSON.stringify(legacy)),
    );
    expect(decoded).not.toBeNull();
    expect(decoded!.doc.flowers).toHaveLength(2);
    // Falls back to defaults rather than crashing or producing an invalid note.
    expect(decoded!.doc.text).toEqual(TEXT_DEFAULTS);
  });

  it('leaves a soft-cap arrangement with a full-length note well inside the URL budget', () => {
    // The soft cap is the size the UI actively steers people towards, so this
    // is the guarantee that matters: a realistic arrangement plus the longest
    // permitted note still shares as a link, with room to spare.
    const doc: Doc = {
      ...docWith(LIMITS.softCap),
      text: { ...TEXT_DEFAULTS, content: 'x'.repeat(LIMITS.textMaxLength) },
    };
    expect(buildShareUrl(doc, 'https://example.com/').length).toBeLessThanOrEqual(
      SAFE_URL_LENGTH,
    );
  });

  it('adds only a bounded amount to the payload', () => {
    // Guards against a codec change that makes notes disproportionately
    // expensive — the note must cost roughly its own length, not multiples.
    const base = docWith(LIMITS.softCap);
    const withNote: Doc = {
      ...base,
      text: { ...TEXT_DEFAULTS, content: 'x'.repeat(LIMITS.textMaxLength) },
    };
    const cost = encodeShare(withNote).length - encodeShare(base).length;
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(LIMITS.textMaxLength * 2);
  });

  it('can push a hard-cap arrangement past the URL budget, which the UI handles', () => {
    // Documenting real behaviour rather than wishing it away. A 40-flower
    // arrangement already sits within ~20 characters of the ceiling before any
    // note, so a note tips it over. Toolbar.tsx checks the same limit and tells
    // the user to save JSON instead, so this degrades rather than breaking.
    const doc: Doc = {
      ...docWith(LIMITS.hardCap),
      text: { ...TEXT_DEFAULTS, content: 'x'.repeat(LIMITS.textMaxLength) },
    };
    expect(buildShareUrl(doc, 'https://example.com/').length).toBeGreaterThan(
      SAFE_URL_LENGTH,
    );
    // Still decodable — over budget is a sharing limit, not a corrupt payload.
    expect(decodeShare(encodeShare(doc))!.doc.flowers).toHaveLength(LIMITS.hardCap);
  });
});

describe('note normalisation', () => {
  it('caps length and line count', () => {
    const { doc } = normalizeDoc({
      text: { content: `${'a'.repeat(200)}\nb\nc\nd\ne\nf` },
    });
    expect(doc.text.content.length).toBeLessThanOrEqual(LIMITS.textMaxLength);
    expect(doc.text.content.split('\n').length).toBeLessThanOrEqual(LIMITS.textMaxLines);
  });

  it('clamps size and repairs unknown placement, font and colour', () => {
    const { doc } = normalizeDoc({
      text: { content: 'hi', size: 99, placement: 'nowhere', font: 'comic', color: 'nope' },
    });
    expect(doc.text.size).toBe(LIMITS.textSize.max);
    expect(doc.text.placement).toBe(TEXT_DEFAULTS.placement);
    expect(doc.text.font).toBe(TEXT_DEFAULTS.font);
    expect(doc.text.color).toBe(TEXT_DEFAULTS.color);
  });

  it('defaults a document that has no note at all', () => {
    expect(normalizeDoc({}).doc.text).toEqual(TEXT_DEFAULTS);
  });
});
