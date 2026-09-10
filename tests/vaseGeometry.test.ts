/**
 * Geometry tests.
 *
 * The `u`/`depth` rim-space model is the load-bearing architectural decision in
 * this app, so its two directions (anchorAt / fromPoint) get tested against every
 * registered vase shape and across the whole proportion range.
 */
import { describe, expect, it } from 'vitest';
import '../src/catalog';
import { allVaseTypes } from '../src/catalog/registry';
import { DEPTH_BOUNDS, SCENE, buildBodyPath, buildVaseGeometry } from '../src/render/vaseGeometry';
import { LIMITS } from '../src/lib/normalize';
import type { VaseState } from '../src/types';

const vases = allVaseTypes();

const vaseState = (over: Partial<VaseState> = {}): VaseState => ({
  shapeId: vases[0]!.id,
  material: 'matte',
  pattern: 'none',
  color: '#d9dcd6',
  accent: '#b39c74',
  height: 1,
  width: 1,
  ...over,
});

describe('buildBodyPath', () => {
  it.each(vases.map((t) => [t.id, t] as const))('%s produces a closed finite path', (_id, type) => {
    const { d, rimRx, baseRx } = buildBodyPath({
      profile: type.profile,
      cx: 100,
      baseY: 200,
      height: 150,
      halfWidth: 60,
    });
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toMatch(/NaN|Infinity|undefined/);
    expect(rimRx).toBeGreaterThan(0);
    expect(baseRx).toBeGreaterThan(0);
  });
});

describe('anchorAt', () => {
  it.each(vases.map((t) => [t.id, t] as const))(
    '%s seats every anchor inside its rim ellipse',
    (_id, type) => {
      const geo = buildVaseGeometry(vaseState({ shapeId: type.id }), type);
      for (let ui = 0; ui <= 10; ui += 1) {
        for (let di = 0; di <= 10; di += 1) {
          const a = geo.anchorAt(ui / 10, di / 10);
          // Normalised ellipse equation: <= 1 means inside.
          const dx = (a.x - geo.cx) / geo.rimRx;
          const dy = (a.y - geo.rimY) / geo.rimRy;
          expect(dx * dx + dy * dy).toBeLessThanOrEqual(1.0001);
          expect(Number.isFinite(a.scale)).toBe(true);
        }
      }
    },
  );

  it('clamps depth to the usable band', () => {
    const type = vases[0]!;
    const geo = buildVaseGeometry(vaseState(), type);
    expect(geo.anchorAt(0.5, -3)).toEqual(geo.anchorAt(0.5, DEPTH_BOUNDS.min));
    expect(geo.anchorAt(0.5, 9)).toEqual(geo.anchorAt(0.5, DEPTH_BOUNDS.max));
  });

  it('clamps u to the rim', () => {
    const type = vases[0]!;
    const geo = buildVaseGeometry(vaseState(), type);
    expect(geo.anchorAt(-1, 0.5).x).toBeCloseTo(geo.anchorAt(0, 0.5).x, 6);
    expect(geo.anchorAt(2, 0.5).x).toBeCloseTo(geo.anchorAt(1, 0.5).x, 6);
  });

  it('scales flowers larger toward the front, for depth cueing', () => {
    const type = vases[0]!;
    const geo = buildVaseGeometry(vaseState(), type);
    expect(geo.anchorAt(0.5, DEPTH_BOUNDS.max).scale).toBeGreaterThan(
      geo.anchorAt(0.5, DEPTH_BOUNDS.min).scale,
    );
  });
});

describe('fromPoint', () => {
  it.each(vases.map((t) => [t.id, t] as const))('%s round-trips u and depth', (_id, type) => {
    const geo = buildVaseGeometry(vaseState({ shapeId: type.id }), type);
    for (const u of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      for (const depth of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const a = geo.anchorAt(u, depth);
        const back = geo.fromPoint(a.x, a.y);
        expect(back.u).toBeCloseTo(u, 4);
        expect(back.depth).toBeCloseTo(depth, 4);
      }
    }
  });

  it('never returns out-of-range values, however wild the input', () => {
    const type = vases[0]!;
    const geo = buildVaseGeometry(vaseState(), type);
    for (const [x, y] of [
      [-9999, -9999],
      [9999, 9999],
      [SCENE.cx, SCENE.groundY],
      [0, 0],
    ] as const) {
      const { u, depth } = geo.fromPoint(x, y);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(depth).toBeGreaterThanOrEqual(DEPTH_BOUNDS.min);
      expect(depth).toBeLessThanOrEqual(DEPTH_BOUNDS.max);
    }
  });
});

describe('proportions', () => {
  it('keeps the vase on the ground and inside the canvas at every size', () => {
    for (const type of vases) {
      for (const height of [LIMITS.vaseHeight.min, 1, LIMITS.vaseHeight.max]) {
        for (const width of [LIMITS.vaseWidth.min, 1, LIMITS.vaseWidth.max]) {
          const geo = buildVaseGeometry(vaseState({ shapeId: type.id, height, width }), type);
          expect(geo.baseY).toBe(SCENE.groundY);
          expect(geo.rimY).toBeGreaterThan(0);
          expect(geo.rimY).toBeLessThan(geo.baseY);

          // The ACTUAL widest point, sampled from the profile — `geo.width` is
          // only the nominal width, and a bulging profile exceeds it.
          let widest = 0;
          for (let i = 0; i <= 200; i += 1) {
            widest = Math.max(widest, geo.halfWidthAtY(geo.baseY - geo.height * (i / 200)));
          }
          expect(geo.cx + widest).toBeLessThanOrEqual(SCENE.w);
          expect(geo.cx - widest).toBeGreaterThanOrEqual(0);
          // The rim must also stay on canvas vertically once its ellipse is drawn.
          expect(geo.rimY - geo.rimRy).toBeGreaterThan(0);
        }
      }
    }
  });

  it('puts the water line below the rim and inside the body', () => {
    for (const type of vases) {
      const geo = buildVaseGeometry(vaseState({ shapeId: type.id }), type);
      expect(geo.waterY).toBeGreaterThan(geo.rimY);
      expect(geo.waterY).toBeLessThan(geo.baseY);
      expect(geo.halfWidthAtY(geo.waterY)).toBeGreaterThan(0);
    }
  });
});
