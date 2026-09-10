import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';
import { cupPath } from './petals';

/** Three overlapping cup petals: two splayed behind, one closed in front. */
const Head: FC<HeadProps> = ({ colors, seed }) => {
  const rng = makeRng(seed);
  const h = 31 + jitter(rng, 2.2);
  const w = 14.5 + jitter(rng, 1.1);
  const stroke = outlineFor(colors.petal);
  const splay = 13 + jitter(rng, 3.5);

  return (
    <g>
      {[-splay, splay].map((angle, i) => (
        <path
          key={i}
          d={cupPath(w * 0.88, h * 0.9)}
          fill={shade(colors.petal, -0.19)}
          stroke={stroke}
          strokeWidth={0.85}
          transform={`rotate(${angle})`}
        />
      ))}
      <path
        d={cupPath(w, h)}
        fill={colors.petal}
        stroke={stroke}
        strokeWidth={0.95}
        strokeLinejoin="round"
      />
      {/* Fold between the front petals, plus a soft sheen down one side */}
      <path
        d={`M 0 ${-h * 0.06} L 0 ${-h * 0.98}`}
        stroke={shade(colors.petal, -0.24)}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <path
        d={`M ${-w * 0.52} ${-h * 0.24} C ${-w * 0.74} ${-h * 0.52} ${-w * 0.6} ${-h * 0.78} ${-w * 0.34} ${-h * 0.9}`}
        fill="none"
        stroke={shade(colors.accent, 0.3)}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  );
};

export default registerFlower({
  id: 'tulip',
  name: 'Tulip',
  category: 'bloom',
  capabilities: ['petalColor', 'accentColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#e2456b', '#f4762f', '#f6c531', '#f0f0ea', '#a8459c', '#d94f3d', '#6c3f8f'],
  headRadius: 22,
  hit: { cy: -18, r: 22 },
  defaults: {
    colors: { petal: '#e2456b', accent: '#ffe3b0', stem: '#5b8a4a' },
    size: 1,
    stemLength: 1.08,
  },
  stem: { thickness: 1.2, leaves: 'pair', curve: -0.18 },
  Head,
});
