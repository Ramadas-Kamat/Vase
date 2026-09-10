import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter, rangeInt } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';
import { rayPetalPath, radial } from './petals';

/** Two offset rings of ray petals around a large seeded disc. */
const Head: FC<HeadProps> = ({ colors, seed }) => {
  const rng = makeRng(seed);
  const R = 31;
  const n = rangeInt(rng, 15, 18);
  const stroke = outlineFor(colors.petal);
  const spin = jitter(rng, 24);
  const disc = R * 0.44;

  // Phyllotactic seed pattern on the disc — golden-angle spiral.
  const seeds = Array.from({ length: 46 }, (_, i) => {
    const t = i / 46;
    const r = disc * 0.92 * Math.sqrt(t);
    const a = i * 137.508 * (Math.PI / 180);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, r: 1.05 + t * 0.6 };
  });

  return (
    <g transform={`translate(0 ${-R * 0.7})`}>
      {radial(n, spin + 360 / n / 2).map((angle, i) => (
        <path
          key={`b${i}`}
          d={rayPetalPath(R * 0.22, R * 0.97)}
          fill={shade(colors.petal, -0.22)}
          stroke={stroke}
          strokeWidth={0.7}
          transform={`rotate(${angle})`}
        />
      ))}
      {radial(n, spin).map((angle, i) => (
        <path
          key={`f${i}`}
          d={rayPetalPath(R * 0.24, R * 0.85)}
          fill={shade(colors.petal, i % 2 ? 0.02 : -0.06)}
          stroke={stroke}
          strokeWidth={0.7}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle r={disc} fill={colors.accent} stroke={outlineFor(colors.accent)} strokeWidth={1} />
      <circle r={disc * 0.97} fill={shade(colors.accent, -0.16)} />
      {seeds.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={shade(colors.accent, -0.42)} opacity={0.85} />
      ))}
    </g>
  );
};

export default registerFlower({
  id: 'sunflower',
  name: 'Sunflower',
  category: 'bloom',
  capabilities: ['petalColor', 'accentColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#f2b229', '#f5c65a', '#e88b1f', '#f7dd7a', '#d96b21'],
  headRadius: 31,
  hit: { cy: -22, r: 32 },
  defaults: {
    colors: { petal: '#f2b229', accent: '#8a5a2b', stem: '#4d7040' },
    size: 1.06,
    stemLength: 1.14,
  },
  // Heaviest bloom: thickest stem, and the sway engine damps it accordingly.
  stem: { thickness: 1.55, leaves: 'alternate', curve: -0.12 },
  Head,
});
