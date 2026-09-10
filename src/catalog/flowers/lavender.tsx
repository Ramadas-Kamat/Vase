import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter, rangeInt } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';

/** A tapering vertical spike of florets rather than a single bloom. */
const Head: FC<HeadProps> = ({ colors, seed }) => {
  const rng = makeRng(seed);
  const count = rangeInt(rng, 24, 30);
  const spikeLen = 52 + jitter(rng, 5);
  const stroke = outlineFor(colors.petal);

  const florets = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const y = -6 - t * spikeLen;
    const spread = (1 - t) * 6.6 + 1.2;
    const side = i % 2 === 0 ? -1 : 1;
    return {
      x: side * spread * (0.62 + rng() * 0.4),
      y: y + jitter(rng, 1.1),
      r: (3.3 - t * 1.7) * (0.85 + rng() * 0.3),
      tone: i % 3 === 0 ? -0.16 : i % 3 === 1 ? 0.06 : -0.04,
    };
  });

  return (
    <g>
      {/* Central rachis continuing the stem up through the spike */}
      <path
        d={`M 0 0 L ${jitter(rng, 2)} ${-6 - spikeLen - 4}`}
        stroke={shade(colors.stem, -0.06)}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {florets.map((fl, i) => (
        <ellipse
          key={i}
          cx={fl.x}
          cy={fl.y}
          rx={fl.r}
          ry={fl.r * 1.35}
          fill={shade(colors.petal, fl.tone)}
          stroke={stroke}
          strokeWidth={0.5}
          transform={`rotate(${fl.x > 0 ? 20 : -20} ${fl.x} ${fl.y})`}
        />
      ))}
      {/* Bud tip */}
      <ellipse
        cx={0}
        cy={-6 - spikeLen - 3}
        rx={1.7}
        ry={3.4}
        fill={shade(colors.accent, -0.05)}
        stroke={stroke}
        strokeWidth={0.5}
      />
    </g>
  );
};

export default registerFlower({
  id: 'lavender',
  name: 'Lavender',
  category: 'bloom',
  capabilities: ['petalColor', 'accentColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#8f7bc4', '#a68fd6', '#6f5aa8', '#c3b2e6', '#e8e0f7', '#5f4b8f'],
  headRadius: 16,
  hit: { cy: -32, r: 24 },
  defaults: {
    colors: { petal: '#8f7bc4', accent: '#b7a6de', stem: '#7f8f63' },
    size: 0.95,
    stemLength: 1.12,
  },
  // Slender and light — the sway engine gives it the most movement.
  stem: { thickness: 0.7, leaves: 'none', curve: 0.34 },
  Head,
});
