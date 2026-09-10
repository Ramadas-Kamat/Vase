/**
 * Share-link codec.
 *
 * A raw JSON document is ~90 bytes per flower, which base64s past the ~2000
 * character URL ceiling well before the 40-flower cap. So we do two things:
 *
 *  1. Transpose to a positional array form with quantised numbers and no `#` on
 *     colours — roughly a 3× reduction before compression.
 *  2. Run it through lz-string's URI-safe LZW, which exploits the heavy
 *     repetition between flowers (same type ids, same palette) very effectively.
 *
 * A 40-flower arrangement lands around 700–900 characters, comfortably inside
 * the ceiling. Decoding is deliberately paranoid: anything unrecognised falls
 * through to `normalizeDoc`, which repairs or drops it.
 */
import LZString from 'lz-string';
import type { Doc } from '../types';
import { MATERIALS, PATTERNS, TEXT_FONTS, TEXT_PLACEMENTS } from '../types';
import { normalizeDoc } from './normalize';

/** Bump only if the positional layout below changes. */
const CODEC_VERSION = 1;

const hex = (c: string) => c.replace('#', '');
const unhex = (c: unknown) => (typeof c === 'string' ? `#${c.replace('#', '')}` : '');
const q = (n: number, factor: number) => Math.round(n * factor);

type PackedFlower = [
  string, // typeId
  number, // seed
  number, // u * 1000
  number, // depth * 1000
  number, // lean * 10
  number, // size * 100
  number, // stemLength * 100
  string, // petal (no #)
  string, // accent (no #)
  string, // stem (no #)
  number | null, // z * 1000
];

type PackedVase = [string, number, number, string, string, number, number];

type PackedText = [
  string, // content
  number, // placement index
  number, // font index
  string, // colour (no #)
  number, // size * 100
];

/**
 * `text` is APPENDED, and omitted entirely when there is no note. That keeps
 * this backward and forward compatible without a version bump: links written
 * before notes existed decode with `text` undefined and pick up defaults, and
 * an older client reading a newer link simply ignores the extra element.
 */
type Packed = [number, number, PackedVase, PackedFlower[], PackedText?];

function pack(doc: Doc): Packed {
  const v = doc.vase;
  const t = doc.text;
  const base: Packed = [
    CODEC_VERSION,
    doc.theme === 'dark' ? 1 : 0,
    [
      v.shapeId,
      Math.max(0, MATERIALS.indexOf(v.material)),
      Math.max(0, PATTERNS.indexOf(v.pattern)),
      hex(v.color),
      hex(v.accent),
      q(v.height, 100),
      q(v.width, 100),
    ],
    doc.flowers.map((f): PackedFlower => [
      f.typeId,
      f.seed,
      q(f.u, 1000),
      q(f.depth, 1000),
      q(f.lean, 10),
      q(f.size, 100),
      q(f.stemLength, 100),
      hex(f.colors.petal),
      hex(f.colors.accent),
      hex(f.colors.stem),
      f.z === null ? null : q(f.z, 1000),
    ]),
  ];

  if (t.content.length > 0) {
    base[4] = [
      t.content,
      Math.max(0, TEXT_PLACEMENTS.indexOf(t.placement)),
      Math.max(0, TEXT_FONTS.indexOf(t.font)),
      hex(t.color),
      q(t.size, 100),
    ];
  }
  return base;
}

function unpack(raw: unknown): unknown {
  if (!Array.isArray(raw)) return null;
  const [version, themeFlag, vase, flowers, text] = raw as Packed;
  if (version !== CODEC_VERSION || !Array.isArray(vase)) return null;

  return {
    v: 1,
    theme: themeFlag === 1 ? 'dark' : 'light',
    vase: {
      shapeId: vase[0],
      material: MATERIALS[vase[1]],
      pattern: PATTERNS[vase[2]],
      color: unhex(vase[3]),
      accent: unhex(vase[4]),
      height: vase[5] / 100,
      width: vase[6] / 100,
    },
    flowers: (Array.isArray(flowers) ? flowers : []).map((f: PackedFlower) => ({
      typeId: f[0],
      seed: f[1],
      u: f[2] / 1000,
      depth: f[3] / 1000,
      lean: f[4] / 10,
      size: f[5] / 100,
      stemLength: f[6] / 100,
      colors: { petal: unhex(f[7]), accent: unhex(f[8]), stem: unhex(f[9]) },
      z: f[10] === null || f[10] === undefined ? null : f[10] / 1000,
    })),
    // Left undefined for older links; `normalizeText` supplies the defaults.
    text: Array.isArray(text)
      ? {
          content: text[0],
          placement: TEXT_PLACEMENTS[text[1]],
          font: TEXT_FONTS[text[2]],
          color: unhex(text[3]),
          size: text[4] / 100,
        }
      : undefined,
  };
}

export function encodeShare(doc: Doc): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(pack(doc)));
}

/** @returns a repaired document, or null if the payload is unusable. */
export function decodeShare(payload: string): { doc: Doc; dropped: number } | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if (!json) return null;
    const unpacked = unpack(JSON.parse(json));
    if (!unpacked) return null;
    return normalizeDoc(unpacked);
  } catch {
    return null;
  }
}

export const SHARE_HASH_PREFIX = '#a=';

export function buildShareUrl(doc: Doc, baseUrl: string): string {
  const base = baseUrl.split('#')[0];
  return `${base}${SHARE_HASH_PREFIX}${encodeShare(doc)}`;
}

/** Read an arrangement out of `location.hash`, if one is present. */
export function readShareFromHash(hash: string): { doc: Doc; dropped: number } | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  return decodeShare(hash.slice(SHARE_HASH_PREFIX.length));
}
