import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter, rangeInt } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';
import { petalPath, radial } from './petals';
import { polar } from '../../lib/geom';

/** A single ring of slim ray petals around a domed centre. */
const Head: FC<HeadProps> = ({ colors, seed }) => {
  const rng = makeRng(seed);
  const R = 23;
  const n = rangeInt(rng, 12, 15);
  const stroke = outlineFor(colors.petal);
  const spin = jitter(rng, 30);

  return (
    <g transform={`translate(0 ${-R * 0.78})`}>
      {radial(n, spin).map((angle, i) => (
        <path
          key={i}
          d={petalPath(R * 0.2, R * (0.92 + (i % 3) * 0.05), 0.34)}
          fill={shade(colors.petal, i % 2 ? -0.05 : 0.03)}
          stroke={stroke}
          strokeWidth={0.75}
          transform={`rotate(${angle + jitter(rng, 4)})`}
        />
      ))}
      <circle r={R * 0.31} fill={colors.accent} stroke={outlineFor(colors.accent)} strokeWidth={0.8} />
      {radial(7, spin * 0.5).map((angle, i) => {
        const p = polar(R * 0.16, angle);
        return <circle key={i} cx={p.x} cy={p.y} r={0.95} fill={shade(colors.accent, -0.3)} />;
      })}
    </g>
  );
};

export default registerFlower({
  id: 'daisy',
  name: 'Daisy',
  category: 'bloom',
  capabilities: ['petalColor', 'accentColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#fbf7ee', '#ffd9e4', '#ffe8a3', '#cfe4f7', '#e9d7f5', '#ffffff'],
  headRadius: 23,
  hit: { cy: -18, r: 24 },
  defaults: {
    colors: { petal: '#fbf7ee', accent: '#f2c34a', stem: '#6b8f4e' },
    size: 0.92,
    stemLength: 0.94,
  },
  stem: { thickness: 0.85, leaves: 'alternate', curve: 0.3 },
  Head,
});
