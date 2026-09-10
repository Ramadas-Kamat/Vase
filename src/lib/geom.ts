/** Small geometry helpers shared by the renderer and the vase geometry builder. */

export function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Round to 2dp for compact, diff-friendly SVG path output. */
export function f2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export interface Point {
  x: number;
  y: number;
}

/** Point on a cubic Bezier at parameter t. Used to place leaves along a stem. */
export function cubicPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** Tangent angle in degrees on a cubic Bezier at t. Orients leaves to the stem. */
export function cubicAngle(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): number {
  const mt = 1 - t;
  const dx =
    3 * mt * mt * (p1.x - p0.x) +
    6 * mt * t * (p2.x - p1.x) +
    3 * t * t * (p3.x - p2.x);
  const dy =
    3 * mt * mt * (p1.y - p0.y) +
    6 * mt * t * (p2.y - p1.y) +
    3 * t * t * (p3.y - p2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Polar to Cartesian with 0° pointing up, matching how petals are laid out. */
export function polar(radius: number, degrees: number): Point {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
}
