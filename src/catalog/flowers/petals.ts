/**
 * Shared petal and leaf path builders.
 *
 * All paths are drawn in head-local coordinates with the base at the origin and
 * the tip pointing UP (negative y), so a petal can simply be `rotate(angle)`d
 * about the origin to lay out a radial bloom.
 */
import { f2 } from '../../lib/geom';

/**
 * Rounded teardrop petal — the workhorse shape (rose, daisy, blossom).
 * @param width  half-width at the petal's widest point
 * @param length tip distance from the base
 * @param curl   0 = slim and pointed, 1 = broad and round
 */
export function petalPath(width: number, length: number, curl = 0.8): string {
  const w = width;
  const l = length;
  const shoulder = 0.28 + curl * 0.22;
  const tipPull = 0.72 + curl * 0.2;
  return [
    'M 0 0',
    `C ${f2(-w)} ${f2(-l * shoulder)} ${f2(-w * tipPull)} ${f2(-l * 0.9)} 0 ${f2(-l)}`,
    `C ${f2(w * tipPull)} ${f2(-l * 0.9)} ${f2(w)} ${f2(-l * shoulder)} 0 0`,
    'Z',
  ].join(' ');
}

/** Sharp, straight-edged ray petal (sunflower). */
export function rayPetalPath(width: number, length: number): string {
  return [
    'M 0 0',
    `C ${f2(-width)} ${f2(-length * 0.3)} ${f2(-width * 0.5)} ${f2(-length * 0.7)} 0 ${f2(-length)}`,
    `C ${f2(width * 0.5)} ${f2(-length * 0.7)} ${f2(width)} ${f2(-length * 0.3)} 0 0`,
    'Z',
  ].join(' ');
}

/** Closed tulip cup, base at the origin. */
export function cupPath(width: number, height: number): string {
  const w = width;
  const h = height;
  return [
    'M 0 0',
    `C ${f2(-w)} ${f2(-h * 0.22)} ${f2(-w * 1.02)} ${f2(-h * 0.74)} ${f2(-w * 0.66)} ${f2(-h)}`,
    `C ${f2(-w * 0.3)} ${f2(-h * 1.12)} ${f2(w * 0.3)} ${f2(-h * 1.12)} ${f2(w * 0.66)} ${f2(-h)}`,
    `C ${f2(w * 1.02)} ${f2(-h * 0.74)} ${f2(w)} ${f2(-h * 0.22)} 0 0`,
    'Z',
  ].join(' ');
}

/** Rounded leaf, base at the origin, tip up. Used for stem foliage. */
export function leafPath(width: number, length: number): string {
  return [
    'M 0 0',
    `C ${f2(-width)} ${f2(-length * 0.34)} ${f2(-width * 0.72)} ${f2(-length * 0.86)} 0 ${f2(-length)}`,
    `C ${f2(width * 0.72)} ${f2(-length * 0.86)} ${f2(width)} ${f2(-length * 0.34)} 0 0`,
    'Z',
  ].join(' ');
}

/** Radial layout angles for `count` items, offset by `spin` degrees. */
export function radial(count: number, spin = 0): number[] {
  return Array.from({ length: count }, (_, i) => spin + (360 / count) * i);
}
