/**
 * Minimal hex colour maths. Used for derived shading (gradients, petal depth,
 * rim highlights) so a single user-chosen colour produces a coherent set of
 * tones instead of requiring five colour pickers per flower.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function parseHex(hex: string): Rgb {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 128, g: 128, b: 128 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const p = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** Lighten (amount > 0) or darken (amount < 0). amount is roughly -1..1. */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  if (amount >= 0) {
    return toHex({
      r: r + (255 - r) * amount,
      g: g + (255 - g) * amount,
      b: b + (255 - b) * amount,
    });
  }
  const k = 1 + amount;
  return toHex({ r: r * k, g: g * k, b: b * k });
}

export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

/** Perceived luminance, 0 (black) .. 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A contrasting outline colour, so pale flowers stay legible on pale themes. */
export function outlineFor(hex: string): string {
  return shade(hex, luminance(hex) > 0.72 ? -0.28 : -0.42);
}

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeHex(value: string, fallback: string): string {
  if (!isValidHex(value)) return fallback;
  return toHex(parseHex(value));
}
