import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter, range } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';
import { petalPath, radial } from './petals';

interface Spot {
  x: number;
  y: number;
  s: number;
}

/** A twig carrying several five-petal blossoms and a couple of unopened buds. */
const Head: FC<HeadProps> = ({ colors, seed }) => {
  const rng = makeRng(seed);
  const stroke = outlineFor(colors.petal);
  const twig = shade(colors.stem, -0.22);

  const spots: Spot[] = [
    { x: -13 + jitter(rng, 3), y: -19 + jitter(rng, 3), s: range(rng, 0.94, 1.08) },
    { x: 10 + jitter(rng, 3), y: -27 + jitter(rng, 3), s: range(rng, 0.84, 0.98) },
    { x: -3 + jitter(rng, 3), y: -40 + jitter(rng, 3), s: range(rng, 0.7, 0.86) },
    { x: 17 + jitter(rng, 3), y: -11 + jitter(rng, 2), s: range(rng, 0.62, 0.78) },
  ];
  const buds: Spot[] = [
    { x: -18 + jitter(rng, 2), y: -33 + jitter(rng, 2), s: 0.95 },
    { x: 6 + jitter(rng, 2), y: -46 + jitter(rng, 2), s: 0.8 },
  ];

  return (
    <g>
      {/* Twigs radiating from the stem tip to each blossom */}
      {[...spots, ...buds].map((p, i) => (
        <path
          key={`t${i}`}
          d={`M 0 0 Q ${p.x * 0.4} ${p.y * 0.72} ${p.x} ${p.y}`}
          fill="none"
          stroke={twig}
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      ))}
      {buds.map((p, i) => (
        <circle
          key={`b${i}`}
          cx={p.x}
          cy={p.y}
          r={3.4 * p.s}
          fill={shade(colors.petal, -0.2)}
          stroke={stroke}
          strokeWidth={0.6}
        />
      ))}
      {spots.map((p, i) => (
        <g key={`f${i}`} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
          {radial(5, jitter(rng, 40)).map((angle, j) => (
            <path
              key={j}
              d={petalPath(5.4, 9.2, 1)}
              fill={shade(colors.petal, j % 2 ? -0.07 : 0.03)}
              stroke={stroke}
              strokeWidth={0.6}
              transform={`rotate(${angle})`}
            />
          ))}
          <circle r={2.1} fill={colors.accent} />
          {radial(5, 20).map((angle, j) => {
            const rad = ((angle - 90) * Math.PI) / 180;
            return (
              <circle
                key={j}
                cx={Math.cos(rad) * 3.4}
                cy={Math.sin(rad) * 3.4}
                r={0.75}
                fill={shade(colors.accent, -0.35)}
              />
            );
          })}
        </g>
      ))}
    </g>
  );
};

export default registerFlower({
  id: 'blossom',
  name: 'Blossom',
  category: 'bloom',
  capabilities: ['petalColor', 'accentColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#f8d3dd', '#f6b8c8', '#ffffff', '#f4dfe8', '#e9a3bd', '#fbe6d4'],
  headRadius: 26,
  hit: { cy: -26, r: 30 },
  defaults: {
    colors: { petal: '#f8d3dd', accent: '#e0a03f', stem: '#7a5b4a' },
    size: 1,
    stemLength: 1.05,
  },
  stem: { thickness: 1.05, leaves: 'none', curve: -0.3 },
  Head,
});
