/**
 * Derives every absolute coordinate in the scene from a vase's `profile(t)`.
 *
 * This module is the reason a new vase is one file. Nothing else in the codebase
 * knows how a vase is shaped: the body outline, rim ellipse, base ellipse,
 * interior cavity, water line, and the anchor point of every flower stem are all
 * computed here from the silhouette function.
 *
 * Consequence: changing the vase shape, height or width re-seats all existing
 * flowers correctly and for free, because a flower stores `u`/`depth` (rim-space)
 * rather than x/y (pixel-space).
 */
import type { VaseState, VaseType } from '../types';
import { clamp, f2 } from '../lib/geom';

/** SVG user-unit canvas. Fixed, so exports are deterministic. */
export const SCENE = { w: 720, h: 720, cx: 360, groundY: 626 } as const;

/** Vase dimensions at multiplier 1. */
const NOMINAL = { w: 216, h: 272 } as const;

/** Profile sample count for the body outline. 44 is visually smooth at 720px. */
const SAMPLES = 44;

/**
 * Flowers are kept off the extreme front/back of the rim ellipse (where the
 * available width collapses to zero) and inset from the rim edge so stems read
 * as sitting inside the mouth rather than balanced on the lip.
 */
const DEPTH_MIN = 0.08;
const DEPTH_MAX = 0.92;
const U_INSET = 0.86;

/**
 * Ceiling on `VaseType.profile`. A profile may exceed 1 — `bulb` peaks near 1.06
 * so its belly bulges past the nominal width — because the canvas has room:
 * NOMINAL.w/2 × vaseWidth.max × PROFILE_MAX = 108 × 1.4 × 1.15 ≈ 174, well
 * inside the 360 units available either side of centre.
 *
 * The limit exists to keep shapes visually comparable and the picker thumbnails
 * consistent, not because the renderer would break. Enforced by
 * `tests/registry.test.ts`, which is the only thing that can enforce it — a
 * profile is an arbitrary function, so there is nothing to validate at runtime
 * short of sampling every shape on every render.
 */
export const PROFILE_MAX = 1.15;

export interface Anchor {
  /** Absolute scene coordinates of the stem's seat in the vase mouth. */
  x: number;
  y: number;
  /** Perspective scale: flowers at the back of the mouth render slightly smaller. */
  scale: number;
}

export interface VaseGeometry {
  type: VaseType;
  width: number;
  height: number;
  cx: number;
  baseY: number;
  rimY: number;
  rimRx: number;
  rimRy: number;
  baseRx: number;
  baseRy: number;
  /** Closed outline of the vase body, front lip included. */
  bodyPath: string;
  /** How far below the rim the interior cavity is drawn (stems descend into it). */
  interiorDepth: number;
  /** y of the water surface — only rendered for the glass material. */
  waterY: number;
  /** Rim-space (u, depth) → absolute scene coordinates. */
  anchorAt(u: number, depth: number): Anchor;
  /** Absolute scene coordinates → rim-space (u, depth). Inverse of `anchorAt`. */
  fromPoint(x: number, y: number): { u: number; depth: number };
  /** Half-width available at a given depth, used by drag to scale u-sensitivity. */
  availableHalfWidth(depth: number): number;
  /** Body half-width at an absolute y — used to size the water surface. */
  halfWidthAtY(y: number): number;
}

export interface BodyPathOptions {
  profile: (t: number) => number;
  cx: number;
  baseY: number;
  height: number;
  /** Half-width in user units at profile value 1. */
  halfWidth: number;
  samples?: number;
}

export interface BodyPathResult {
  d: string;
  rimRx: number;
  rimRy: number;
  baseRx: number;
  baseRy: number;
  half: (t: number) => number;
}

/**
 * Turns a profile function into a closed body outline.
 *
 * Shared by the scene renderer and the vase-picker thumbnails so the two can
 * never disagree about what a shape looks like.
 *
 * Arc sweep flags are the fiddly part: 0 for the front lip (left rim → right rim
 * through the BOTTOM of the rim ellipse, which is the near edge) and 1 for the
 * base (right → left through the bottom, so the vase reads as sitting down).
 */
export function buildBodyPath(options: BodyPathOptions): BodyPathResult {
  const { profile, cx, baseY, height, halfWidth, samples = SAMPLES } = options;
  const half = (t: number) => Math.max(0.03, profile(clamp(t, 0, 1))) * halfWidth;

  const rimRx = half(1);
  const rimRy = Math.max(halfWidth * 0.03, rimRx * 0.3);
  const baseRx = half(0);
  const baseRy = Math.max(halfWidth * 0.02, baseRx * 0.26);
  const rimY = baseY - height;

  const points = Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    return { h: half(t), y: baseY - height * t };
  });
  const leftUp = points.map((s) => ({ x: cx - s.h, y: s.y }));
  const rightDown = [...points].reverse().map((s) => ({ x: cx + s.h, y: s.y }));

  const d = [
    `M ${f2(leftUp[0]!.x)} ${f2(leftUp[0]!.y)}`,
    ...leftUp.slice(1).map((p) => `L ${f2(p.x)} ${f2(p.y)}`),
    `A ${f2(rimRx)} ${f2(rimRy)} 0 0 0 ${f2(cx + rimRx)} ${f2(rimY)}`,
    ...rightDown.slice(1).map((p) => `L ${f2(p.x)} ${f2(p.y)}`),
    `A ${f2(baseRx)} ${f2(baseRy)} 0 0 1 ${f2(cx - baseRx)} ${f2(baseY)}`,
    'Z',
  ].join(' ');

  return { d, rimRx, rimRy, baseRx, baseRy, half };
}

export function buildVaseGeometry(vase: VaseState, type: VaseType): VaseGeometry {
  const width = NOMINAL.w * vase.width;
  const height = NOMINAL.h * vase.height;
  const cx = SCENE.cx;
  const baseY = SCENE.groundY;
  const rimY = baseY - height;

  const {
    d: bodyPath,
    rimRx,
    rimRy,
    baseRx,
    baseRy,
    half,
  } = buildBodyPath({
    profile: type.profile,
    cx,
    baseY,
    height,
    halfWidth: width / 2,
  });

  const interiorDepth = Math.min(height * 0.52, 118);
  const waterY = rimY + interiorDepth * 0.52;

  const availableHalfWidth = (depth: number): number => {
    const d = clamp(depth, DEPTH_MIN, DEPTH_MAX);
    const dy = (d - 0.5) * 2 * rimRy;
    const inner = Math.max(0.02, 1 - (dy / rimRy) ** 2);
    return Math.max(2, rimRx * Math.sqrt(inner) * U_INSET);
  };

  const anchorAt = (u: number, depth: number): Anchor => {
    const d = clamp(depth, DEPTH_MIN, DEPTH_MAX);
    const dy = (d - 0.5) * 2 * rimRy;
    const availHalf = availableHalfWidth(d);
    return {
      x: cx + (clamp(u, 0, 1) - 0.5) * 2 * availHalf,
      y: rimY + dy,
      scale: 0.9 + d * 0.19,
    };
  };

  const fromPoint = (x: number, y: number) => {
    const depth = clamp(0.5 + (y - rimY) / (2 * rimRy), DEPTH_MIN, DEPTH_MAX);
    const availHalf = availableHalfWidth(depth);
    const u = clamp(0.5 + (x - cx) / (2 * availHalf), 0, 1);
    return { u, depth };
  };

  return {
    type,
    width,
    height,
    cx,
    baseY,
    rimY,
    rimRx,
    rimRy,
    baseRx,
    baseRy,
    bodyPath,
    interiorDepth,
    waterY,
    anchorAt,
    fromPoint,
    availableHalfWidth,
    halfWidthAtY: (y: number) => half((baseY - y) / height),
  };
}

export const DEPTH_BOUNDS = { min: DEPTH_MIN, max: DEPTH_MAX } as const;
