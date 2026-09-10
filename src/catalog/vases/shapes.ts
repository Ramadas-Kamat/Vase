/**
 * The eight stock vase silhouettes.
 *
 * Each is a `profile(t)` function: t 0 = base, 1 = rim, returning half-width as
 * a fraction of the vase's nominal half-width. See `_template.ts` for the full
 * explanation of why this is the only geometry a vase has to supply.
 *
 * They live in one file because each is three lines; a more elaborate vase
 * deserves its own file. Either layout registers identically.
 */
import { registerVase } from '../registry';

/** Straight-sided, subtle taper. The safe default. */
export const cylinder = registerVase({
  id: 'cylinder',
  name: 'Cylinder',
  profile: (t) => 0.86 + t * 0.06,
  capacityHint: 10,
  defaults: { color: '#d9dcd6', accent: '#9aa79b', material: 'matte', pattern: 'none' },
});

/** Classic amphora: swelling belly, pinched neck, flared lip. */
export const amphora = registerVase({
  id: 'amphora',
  name: 'Amphora',
  profile: (t) =>
    0.5 +
    Math.sin(Math.min(1, t * 1.35) * Math.PI) * 0.5 -
    Math.max(0, t - 0.72) * 0.55 +
    Math.max(0, t - 0.9) * 1.6,
  capacityHint: 8,
  defaults: { color: '#c98d6b', accent: '#8f5f45', material: 'gloss', pattern: 'none' },
});

/** Round bulb on a small foot, short neck. Reads as a hand-thrown pot. */
export const bulb = registerVase({
  id: 'bulb',
  name: 'Bulb',
  profile: (t) => {
    const belly = Math.sin(Math.min(1, 0.12 + t * 1.05) * Math.PI) * 0.98;
    const neck = Math.max(0, t - 0.68) * 1.15;
    return Math.max(0.3, belly - neck + 0.08);
  },
  capacityHint: 12,
  defaults: { color: '#a8bcc9', accent: '#6b8494', material: 'gloss', pattern: 'none' },
});

/** Inverted cone — narrow foot opening wide to the rim. Very mid-century. */
export const cone = registerVase({
  id: 'cone',
  name: 'Cone',
  profile: (t) => 0.34 + t * 0.66,
  capacityHint: 11,
  defaults: { color: '#e2d3b8', accent: '#b39c74', material: 'matte', pattern: 'stripes' },
});

/** Flat-sided, square-shouldered. Slight top flare stops it reading as a box. */
export const square = registerVase({
  id: 'square',
  name: 'Square',
  profile: (t) => 0.8 + Math.max(0, t - 0.88) * 0.9,
  capacityHint: 10,
  defaults: { color: '#3f4a52', accent: '#232b31', material: 'matte', pattern: 'terrazzo' },
});

/** Bud vase: tall, very narrow. Intended for one or two stems. */
export const bud = registerVase({
  id: 'bud',
  name: 'Bud vase',
  profile: (t) => 0.46 - Math.max(0, t - 0.25) * 0.28 + Math.max(0, t - 0.92) * 1.1,
  capacityHint: 2,
  defaults: { color: '#c7b7d4', accent: '#8f7ba3', material: 'glass', pattern: 'none' },
});

/** Fishbowl: wide sphere, dramatically pinched mouth. */
export const fishbowl = registerVase({
  id: 'fishbowl',
  name: 'Fishbowl',
  profile: (t) => {
    const sphere = Math.sin(Math.min(1, 0.18 + t * 0.92) * Math.PI);
    return Math.max(0.34, sphere * 1.0 - Math.max(0, t - 0.74) * 1.5);
  },
  capacityHint: 14,
  defaults: { color: '#bcd4d2', accent: '#7ba39f', material: 'glass', pattern: 'none' },
});

/** Tall and narrow with a soft waist. Good for long stems. */
export const tall = registerVase({
  id: 'tall',
  name: 'Tall',
  profile: (t) => 0.62 - Math.sin(t * Math.PI) * 0.14 + t * 0.1,
  capacityHint: 7,
  defaults: { color: '#8c9a86', accent: '#5e6b59', material: 'gradient', pattern: 'none' },
});
