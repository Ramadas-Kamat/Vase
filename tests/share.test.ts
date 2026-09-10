/**
 * Share-codec tests.
 *
 * Two things matter here and nothing else does: a link must survive a round trip
 * unchanged (within the codec's declared quantisation), and a corrupt or outdated
 * link must degrade rather than throw. Share links are the feature the user
 * actually hands to another person, so failures are visible and embarrassing.
 */
import { describe, expect, it } from 'vitest';
import '../src/catalog';
import { allFlowerTypes, allVaseTypes } from '../src/catalog/registry';
import {
  SHARE_HASH_PREFIX,
  buildShareUrl,
  decodeShare,
  encodeShare,
  readShareFromHash,
} from '../src/lib/share';
import { LIMITS, makeFlower, normalizeDoc } from '../src/lib/normalize';
import type { Doc, Flower } from '../src/types';

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

function docWith(count: number): Doc {
  const flowers: Flower[] = [];
  for (let i = 0; i < count; i += 1) {
    const type = types[i % types.length]!;
    const f = makeFlower(type.id, ((i * 7) % 20) / 20, 0.1 + ((i * 3) % 16) / 20);
    if (f) flowers.push(f);
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
