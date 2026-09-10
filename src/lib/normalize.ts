/**
 * Document validation and repair.
 *
 * Every document entering the app from outside — localStorage, a share link, an
 * imported JSON file — passes through here. Documents outlive the catalog: a
 * flower type may be renamed or removed after a link is shared. Rather than
 * crash, we drop unknown flowers and fall back on unknown vases, so old links
 * keep opening.
 */
import type { Doc, DocText, Flower, FlowerColors, Theme, VaseState } from '../types';
import { MATERIALS, PATTERNS, TEXT_FONTS, TEXT_PLACEMENTS } from '../types';
import { getFlowerType, getVaseTypeOrFirst } from '../catalog/registry';
import { clamp } from './geom';
import { normalizeHex } from './color';
import { newSeed } from './rng';
import { DEPTH_BOUNDS } from '../render/vaseGeometry';

export const LIMITS = {
  size: { min: 0.55, max: 1.7 },
  stemLength: { min: 0.55, max: 1.75 },
  lean: { min: -26, max: 26 },
  vaseHeight: { min: 0.65, max: 1.45 },
  vaseWidth: { min: 0.65, max: 1.4 },
  textSize: { min: 0.6, max: 1.8 },
  /** Keeps a note inside the share-link budget and inside the artwork. */
  textMaxLength: 80,
  textMaxLines: 4,
  /** Above this the UI warns; arrangements still work. */
  softCap: 24,
  /** Refused beyond this — protects the 60fps target. */
  hardCap: 40,
  historyDepth: 80,
} as const;

export const TEXT_DEFAULTS: DocText = {
  content: '',
  placement: 'caption',
  font: 'serif',
  color: '#5c5346',
  size: 1,
};

let idCounter = 0;

export function nextFlowerId(): string {
  idCounter += 1;
  return `f${idCounter.toString(36)}${((Math.random() * 1e6) | 0).toString(36)}`;
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.length > 0 ? v : fallback;

/** Build a fresh flower of `typeId`, seated at (u, depth). */
export function makeFlower(typeId: string, u: number, depth: number): Flower | null {
  const type = getFlowerType(typeId);
  if (!type) return null;
  const clampedU = clamp(u, 0, 1);
  return {
    id: nextFlowerId(),
    typeId,
    seed: newSeed(),
    u: clampedU,
    depth: clamp(depth, DEPTH_BOUNDS.min, DEPTH_BOUNDS.max),
    // Stems near the rim edge lean outward, which is how a real arrangement
    // falls. Makes a freshly placed flower look intentional rather than rigid.
    lean: (clampedU - 0.5) * 17,
    size: type.defaults.size,
    stemLength: type.defaults.stemLength,
    colors: { ...type.defaults.colors },
    z: null,
  };
}

function normalizeColors(raw: unknown, fallback: FlowerColors): FlowerColors {
  const o = (raw ?? {}) as Partial<FlowerColors>;
  return {
    petal: normalizeHex(str(o.petal, fallback.petal), fallback.petal),
    accent: normalizeHex(str(o.accent, fallback.accent), fallback.accent),
    stem: normalizeHex(str(o.stem, fallback.stem), fallback.stem),
  };
}

function normalizeFlower(raw: unknown): Flower | null {
  const o = (raw ?? {}) as Partial<Flower>;
  const typeId = str(o.typeId, '');
  const type = getFlowerType(typeId);
  if (!type) return null;
  return {
    id: str(o.id, nextFlowerId()),
    typeId,
    seed: num(o.seed, newSeed()) >>> 0,
    u: clamp(num(o.u, 0.5), 0, 1),
    depth: clamp(num(o.depth, 0.5), DEPTH_BOUNDS.min, DEPTH_BOUNDS.max),
    lean: clamp(num(o.lean, 0), LIMITS.lean.min, LIMITS.lean.max),
    size: clamp(num(o.size, type.defaults.size), LIMITS.size.min, LIMITS.size.max),
    stemLength: clamp(
      num(o.stemLength, type.defaults.stemLength),
      LIMITS.stemLength.min,
      LIMITS.stemLength.max,
    ),
    colors: normalizeColors(o.colors, type.defaults.colors),
    z: typeof o.z === 'number' && Number.isFinite(o.z) ? o.z : null,
  };
}

function normalizeVase(raw: unknown): VaseState {
  const o = (raw ?? {}) as Partial<VaseState>;
  // getVaseTypeOrFirst never throws for an unknown id, so a removed shape
  // degrades to the first registered vase instead of breaking the document.
  const type = getVaseTypeOrFirst(str(o.shapeId, ''));
  return {
    shapeId: type.id,
    material: MATERIALS.includes(o.material as never) ? o.material! : type.defaults.material,
    pattern: PATTERNS.includes(o.pattern as never) ? o.pattern! : type.defaults.pattern,
    color: normalizeHex(str(o.color, type.defaults.color), type.defaults.color),
    accent: normalizeHex(str(o.accent, type.defaults.accent), type.defaults.accent),
    height: clamp(num(o.height, 1), LIMITS.vaseHeight.min, LIMITS.vaseHeight.max),
    width: clamp(num(o.width, 1), LIMITS.vaseWidth.min, LIMITS.vaseWidth.max),
  };
}

/**
 * Coerce arbitrary parsed JSON into a valid `Doc`. Never throws.
 * @returns the repaired document plus how many flowers had to be dropped
 */
export function normalizeText(raw: unknown): DocText {
  const o = (raw ?? {}) as Partial<DocText>;
  const content = typeof o.content === 'string' ? o.content : '';
  return {
    // Collapse runaway blank lines first, then cap length, so a paste of a long
    // document degrades to a sensible note rather than being rejected outright.
    content: content
      .split(/\r?\n/)
      .slice(0, LIMITS.textMaxLines)
      .join('\n')
      .slice(0, LIMITS.textMaxLength),
    placement: TEXT_PLACEMENTS.includes(o.placement as never)
      ? o.placement!
      : TEXT_DEFAULTS.placement,
    font: TEXT_FONTS.includes(o.font as never) ? o.font! : TEXT_DEFAULTS.font,
    color: normalizeHex(str(o.color, TEXT_DEFAULTS.color), TEXT_DEFAULTS.color),
    size: clamp(num(o.size, TEXT_DEFAULTS.size), LIMITS.textSize.min, LIMITS.textSize.max),
  };
}

export function normalizeDoc(raw: unknown): { doc: Doc; dropped: number } {
  const o = (raw ?? {}) as Partial<Doc>;
  const rawFlowers = Array.isArray(o.flowers) ? o.flowers : [];
  const flowers: Flower[] = [];
  let dropped = 0;

  for (const rf of rawFlowers.slice(0, LIMITS.hardCap)) {
    const f = normalizeFlower(rf);
    if (f) flowers.push(f);
    else dropped += 1;
  }
  dropped += Math.max(0, rawFlowers.length - LIMITS.hardCap);

  const theme: Theme = o.theme === 'dark' ? 'dark' : 'light';

  return {
    doc: { v: 1, theme, vase: normalizeVase(o.vase), flowers, text: normalizeText(o.text) },
    dropped,
  };
}
