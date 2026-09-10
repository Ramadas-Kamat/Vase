/**
 * Contract tests for the catalog.
 *
 * These are the guard rails for the extension point: if someone adds a flower or
 * a vase that violates an assumption the renderer relies on, it fails here rather
 * than as a mysteriously invisible bloom or a vase with an inverted silhouette.
 */
import { describe, expect, it } from 'vitest';
import '../src/catalog';
import { allFlowerTypes, allVaseTypes } from '../src/catalog/registry';
import { isValidHex } from '../src/lib/color';
import { LIMITS } from '../src/lib/normalize';
import { PROFILE_MAX } from '../src/render/vaseGeometry';

const flowers = allFlowerTypes();
const vases = allVaseTypes();

describe('flower catalog', () => {
  it('is populated', () => {
    expect(flowers.length).toBeGreaterThanOrEqual(8);
  });

  it('has unique ids', () => {
    const ids = flowers.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least one filler, so arrangements can have foliage', () => {
    expect(flowers.some((t) => t.category === 'filler')).toBe(true);
  });

  it.each(flowers.map((t) => [t.id, t] as const))('%s declares a usable type', (_id, type) => {
    expect(type.name.length).toBeGreaterThan(0);
    expect(type.capabilities.length).toBeGreaterThan(0);
    // The tray, the panel and the randomiser all read `palette`.
    expect(type.palette.length).toBeGreaterThan(0);
    expect(type.palette.every(isValidHex)).toBe(true);

    // A zero hit radius would make the flower unselectable.
    expect(type.hit.r).toBeGreaterThan(4);
    // Heads are drawn upward from the stem tip, so the hit centre must be too.
    expect(type.hit.cy).toBeLessThanOrEqual(0);
    expect(type.headRadius).toBeGreaterThan(0);

    expect(isValidHex(type.defaults.colors.petal)).toBe(true);
    expect(isValidHex(type.defaults.colors.accent)).toBe(true);
    expect(isValidHex(type.defaults.colors.stem)).toBe(true);

    // Defaults outside the slider range would snap on first edit.
    expect(type.defaults.size).toBeGreaterThanOrEqual(LIMITS.size.min);
    expect(type.defaults.size).toBeLessThanOrEqual(LIMITS.size.max);
    expect(type.defaults.stemLength).toBeGreaterThanOrEqual(LIMITS.stemLength.min);
    expect(type.defaults.stemLength).toBeLessThanOrEqual(LIMITS.stemLength.max);

    expect(type.stem.thickness).toBeGreaterThan(0);
    expect(Math.abs(type.stem.curve)).toBeLessThanOrEqual(1);
  });
});

describe('vase catalog', () => {
  it('is populated', () => {
    expect(vases.length).toBeGreaterThanOrEqual(8);
  });

  it('has unique ids', () => {
    const ids = vases.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(vases.map((t) => [t.id, t] as const))('%s has a sane profile', (_id, type) => {
    // Fine sampling, not 20 steps: a profile is an arbitrary function and a
    // narrow spike between samples is exactly the bug this test is for.
    for (let i = 0; i <= 400; i += 1) {
      const value = type.profile(i / 400);
      expect(Number.isFinite(value)).toBe(true);
      // At or below 0 the silhouette collapses and the body path degenerates.
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(PROFILE_MAX);
    }
  });

  it.each(vases.map((t) => [t.id, t] as const))('%s reaches a usable width', (_id, type) => {
    let max = 0;
    for (let i = 0; i <= 400; i += 1) max = Math.max(max, type.profile(i / 400));
    // A shape that never gets near nominal width renders as a sliver and looks
    // like a mistake rather than a design.
    expect(max).toBeGreaterThan(0.4);
  });

  it.each(vases.map((t) => [t.id, t] as const))('%s has usable defaults', (_id, type) => {
    expect(type.name.length).toBeGreaterThan(0);
    expect(isValidHex(type.defaults.color)).toBe(true);
    expect(isValidHex(type.defaults.accent)).toBe(true);
    expect(type.capacityHint).toBeGreaterThan(0);
  });
});
