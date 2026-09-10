import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter, rangeInt } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';
import { petalPath, radial } from './petals';

/** Concentric petal rings, tightening and lightening toward a coiled centre. */
const Head: FC<HeadProps> = ({ colors, seed }) => {
  const rng = makeRng(seed);
  const R = 25;
  const stroke = outlineFor(colors.petal);
  const spin = jitter(rng, 36);

  const rings = [
    { n: rangeInt(rng, 7, 8), len: R, w: R * 0.66, tone: -0.2, spin, curl: 1 },
    { n: rangeInt(rng, 6, 7), len: R * 0.76, w: R * 0.55, tone: -0.07, spin: spin + 26 + jitter(rng, 9), curl: 0.94 },
    { n: 5, len: R * 0.52, w: R * 0.43, tone: 0.07, spin: spin + 51 + jitter(rng, 9), curl: 0.88 },
    { n: 4, len: R * 0.31, w: R * 0.31, tone: 0.18, spin: spin + 74, curl: 0.82 },
  ];

  return (
    <g transform={`translate(0 ${-R * 0.72})`}>
      {rings.map((ring, ri) => (
        <g key={ri}>
          {radial(ring.n, ring.spin).map((angle, i) => (
            <path
              key={i}
              d={petalPath(ring.w, ring.len, ring.curl)}
              fill={shade(colors.petal, ring.tone)}
              stroke={stroke}
              strokeWidth={0.85}
              strokeLinejoin="round"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
      ))}
      {/* Coiled heart of the bloom */}
      <path
        d="M 0 -2.4 C 3.4 -2.4 3.6 3 0 3 C -4.4 3 -4.6 -3.6 0 -3.6"
        fill="none"
        stroke={shade(colors.accent, -0.15)}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
};

export default registerFlower({
  id: 'rose',
  name: 'Rose',
  category: 'bloom',
  capabilities: ['petalColor', 'accentColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#c8203f', '#e2536b', '#f291a8', '#f7e2e6', '#f2b33d', '#f6f2ea', '#8d2050'],
  headRadius: 25,
  hit: { cy: -18, r: 27 },
  defaults: {
    colors: { petal: '#d33a56', accent: '#f0c884', stem: '#4f7346' },
    size: 1,
    stemLength: 1,
  },
  stem: { thickness: 1.15, leaves: 'pair', curve: 0.22 },
  Head,
});
