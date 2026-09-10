/**
 * Shared domain types.
 *
 * The whole application is a pure function of `Doc`. Everything else — SVG
 * geometry, screen positions, z-order — is DERIVED at render time. Never store
 * absolute pixel coordinates in `Doc`; store `u`/`depth` and let
 * `render/vaseGeometry.ts` resolve them against the current vase.
 */
import type { FC } from 'react';

export type Material = 'matte' | 'gloss' | 'glass' | 'gradient';
export type Pattern = 'none' | 'stripes' | 'dots' | 'terrazzo';
export type Theme = 'light' | 'dark';

export const MATERIALS: Material[] = ['matte', 'gloss', 'glass', 'gradient'];
export const PATTERNS: Pattern[] = ['none', 'stripes', 'dots', 'terrazzo'];

/**
 * A capability is a property the properties panel knows how to render a control
 * for. A flower type declares which ones apply to it; the panel is generated
 * from that list, so adding a flower never requires touching the UI.
 */
export type Capability =
  | 'petalColor'
  | 'accentColor'
  | 'stemColor'
  | 'size'
  | 'stemLength'
  | 'lean';

export interface FlowerColors {
  petal: string;
  accent: string;
  stem: string;
}

export interface Flower {
  id: string;
  /** Key into the flower registry. */
  typeId: string;
  /** Drives all procedural variation, so two identical settings still differ. */
  seed: number;
  /** Horizontal position across the vase mouth, 0 = left rim, 1 = right rim. */
  u: number;
  /** Front-to-back position in the mouth, 0 = back, 1 = front. Also default z. */
  depth: number;
  /** Stem lean in degrees, pivoting at the rim. */
  lean: number;
  /** Head scale multiplier. */
  size: number;
  /** Stem length multiplier. */
  stemLength: number;
  colors: FlowerColors;
  /** Manual z-order override in the same space as `depth`. null = auto. */
  z: number | null;
}

export interface VaseState {
  /** Key into the vase registry. */
  shapeId: string;
  material: Material;
  pattern: Pattern;
  color: string;
  accent: string;
  /** Height multiplier. */
  height: number;
  /** Width multiplier. */
  width: number;
}

/** The complete serialisable document. Bump `v` on any breaking schema change. */
export interface Doc {
  v: 1;
  theme: Theme;
  vase: VaseState;
  flowers: Flower[];
}

export type Rng = () => number;

/** Props passed to a flower type's `Head` component. */
export interface HeadProps {
  /** Already-applied scale is on the parent group; use this for shape choices. */
  size: number;
  colors: FlowerColors;
  seed: number;
}

export interface StemSpec {
  /** Multiplier on the base stem stroke width. */
  thickness: number;
  leaves: 'none' | 'pair' | 'alternate';
  /** Lateral bow of the stem, -1 (left) .. 1 (right). */
  curve: number;
}

/**
 * A flower type. Add one by dropping a file in `catalog/flowers/` and adding a
 * single import line to `catalog/flowers/index.ts`. See `_template.tsx`.
 */
export interface FlowerType {
  id: string;
  name: string;
  category: 'bloom' | 'filler';
  capabilities: Capability[];
  /** Suggested petal swatches shown in the properties panel. */
  palette: string[];
  /**
   * Approximate bloom radius in user units at size 1. Feeds stem length and
   * sway amplitude, so a heavy sunflower sways less than a sprig of lavender.
   */
  headRadius: number;
  /**
   * Selection / click target, in head-local coordinates where the origin is the
   * stem attachment point and -y is up. Declared per type because a tall spike
   * and a round bloom need very different targets.
   */
  hit: { cy: number; r: number };
  defaults: {
    colors: FlowerColors;
    size: number;
    stemLength: number;
  };
  stem: StemSpec;
  /** Drawn in local coordinates with the origin at the top of the stem. */
  Head: FC<HeadProps>;
}

/**
 * A vase type. Add one by dropping a file in `catalog/vases/` and adding a
 * single import line to `catalog/vases/index.ts`. See `_template.ts`.
 *
 * The silhouette is the only thing you supply: the body path, rim ellipse,
 * water line, interior cavity and flower anchor points are all derived from it.
 */
export interface VaseType {
  id: string;
  name: string;
  /**
   * @param t 0 = base, 1 = rim
   * @returns half-width as a multiple of the vase's nominal half-width. 1 means
   *   "as wide as the vase nominally is". Must stay above 0 and at or below
   *   `PROFILE_MAX` — see `render/vaseGeometry.ts` for why a little headroom
   *   above 1 is allowed (the `bulb` shape uses it for its belly).
   */
  profile: (t: number) => number;
  /** Soft guidance shown in the UI; never enforced. */
  capacityHint: number;
  defaults: {
    color: string;
    accent: string;
    material: Material;
    pattern: Pattern;
  };
}
