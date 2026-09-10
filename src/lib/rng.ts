import type { Rng } from '../types';

/**
 * mulberry32 — small, fast, well-distributed seeded PRNG.
 *
 * Every flower stores a `seed`, and all of its procedural variation (petal
 * count, angle jitter, colour jitter) is drawn from a generator made here. Same
 * seed always yields the same flower, which is what makes documents shareable
 * and renders stable across reloads.
 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Uniform integer in [min, max] inclusive. */
export function rangeInt(rng: Rng, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty array');
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

/** Symmetric jitter around zero: ±amount. */
export function jitter(rng: Rng, amount: number): number {
  return (rng() * 2 - 1) * amount;
}

/** Non-cryptographic seed for newly created flowers. */
export function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
