/**
 * Shipped starter arrangements.
 *
 * The first one is loaded on a first visit — an empty vase teaches the user
 * nothing, whereas a populated one shows what is possible and what is clickable.
 *
 * Presets are written as partial specs and pushed through `normalizeDoc`, so a
 * preset referencing a flower you later delete degrades gracefully rather than
 * breaking the app.
 */
import type { Doc, Flower, VaseState } from './types';
import { makeFlower, normalizeDoc } from './lib/normalize';

interface Spec {
  type: string;
  u: number;
  depth: number;
  patch?: Partial<Omit<Flower, 'id' | 'typeId'>>;
}

export interface Preset {
  id: string;
  name: string;
  build: () => Doc;
}

function build(vase: Partial<VaseState> & { shapeId: string }, specs: Spec[]): Doc {
  const flowers = specs
    .map((s) => {
      const f = makeFlower(s.type, s.u, s.depth);
      return f ? { ...f, ...s.patch } : null;
    })
    .filter((f): f is Flower => f !== null);
  return normalizeDoc({ v: 1, theme: 'light', vase, flowers }).doc;
}

export const PRESETS: Preset[] = [
  {
    id: 'spring',
    name: 'Spring bouquet',
    build: () =>
      build(
        { shapeId: 'bulb', material: 'gloss', pattern: 'none', color: '#a8bcc9', accent: '#6b8494' },
        [
          { type: 'eucalyptus', u: 0.1, depth: 0.16, patch: { lean: -20, stemLength: 1.25 } },
          { type: 'eucalyptus', u: 0.9, depth: 0.2, patch: { lean: 21, stemLength: 1.2 } },
          { type: 'babysbreath', u: 0.28, depth: 0.28, patch: { lean: -13, stemLength: 1.3 } },
          { type: 'tulip', u: 0.42, depth: 0.4, patch: { lean: -6, colors: { petal: '#e2456b', accent: '#ffe3b0', stem: '#5b8a4a' } } },
          { type: 'tulip', u: 0.66, depth: 0.46, patch: { lean: 8, colors: { petal: '#f4762f', accent: '#ffe3b0', stem: '#5b8a4a' } } },
          { type: 'daisy', u: 0.3, depth: 0.66, patch: { lean: -12, stemLength: 0.86 } },
          { type: 'daisy', u: 0.78, depth: 0.72, patch: { lean: 14, stemLength: 0.8 } },
          { type: 'tulip', u: 0.54, depth: 0.88, patch: { lean: 2, stemLength: 0.82, colors: { petal: '#f6c531', accent: '#ffe3b0', stem: '#5b8a4a' } } },
        ],
      ),
  },
  {
    id: 'single-rose',
    name: 'Single rose',
    build: () =>
      build(
        { shapeId: 'bud', material: 'glass', pattern: 'none', color: '#c7b7d4', accent: '#8f7ba3', height: 1.15 },
        [
          { type: 'eucalyptus', u: 0.72, depth: 0.3, patch: { lean: 17, stemLength: 1.1 } },
          { type: 'rose', u: 0.44, depth: 0.74, patch: { lean: -3, size: 1.1, stemLength: 1.05 } },
        ],
      ),
  },
  {
    id: 'ikebana',
    name: 'Ikebana',
    build: () =>
      build(
        { shapeId: 'tall', material: 'gradient', pattern: 'none', color: '#8c9a86', accent: '#4d5a4a', height: 1.12, width: 0.85 },
        [
          { type: 'blossom', u: 0.24, depth: 0.24, patch: { lean: -23, stemLength: 1.5, size: 1.05 } },
          { type: 'eucalyptus', u: 0.82, depth: 0.44, patch: { lean: 24, stemLength: 1.2 } },
          { type: 'lavender', u: 0.5, depth: 0.82, patch: { lean: 3, stemLength: 1.0 } },
        ],
      ),
  },
  {
    id: 'sunny',
    name: 'Sunny table',
    build: () =>
      build(
        { shapeId: 'cone', material: 'matte', pattern: 'stripes', color: '#e2d3b8', accent: '#b39c74' },
        [
          { type: 'babysbreath', u: 0.14, depth: 0.18, patch: { lean: -22, stemLength: 1.35 } },
          { type: 'babysbreath', u: 0.88, depth: 0.22, patch: { lean: 22, stemLength: 1.3 } },
          { type: 'sunflower', u: 0.34, depth: 0.42, patch: { lean: -10, stemLength: 1.24 } },
          { type: 'sunflower', u: 0.68, depth: 0.56, patch: { lean: 11, stemLength: 1.1, size: 0.98 } },
          { type: 'daisy', u: 0.5, depth: 0.86, patch: { lean: 0, stemLength: 0.78 } },
        ],
      ),
  },
];

export function defaultDoc(): Doc {
  return PRESETS[0]!.build();
}
