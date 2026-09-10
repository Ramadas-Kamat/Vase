import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter, range, rangeInt } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';
import { f2, polar } from '../../lib/geom';

/** Filler: an airy two-level branch ending in clusters of tiny florets. */
const Head: FC<HeadProps> = ({ colors, seed }) => {
  const rng = makeRng(seed);
  const branches = rangeInt(rng, 5, 7);
  const twig = shade(colors.stem, -0.1);
  const stroke = outlineFor(colors.petal);

  const stems = Array.from({ length: branches }, (_, i) => {
    const spread = branches === 1 ? 0 : i / (branches - 1) - 0.5;
    const angle = spread * range(rng, 74, 96) + jitter(rng, 7);
    const len = range(rng, 24, 42);
    const tip = polar(len, angle);
    const mid = polar(len * 0.55, angle + jitter(rng, 14));
    // Each branch forks once, then each fork carries a floret cluster.
    const forks = Array.from({ length: rangeInt(rng, 2, 3) }, () => {
      const fa = angle + jitter(rng, 34);
      const fl = range(rng, 7, 14);
      return polar(fl, fa);
    });
    return { tip, mid, forks };
  });

  return (
    <g>
      {stems.map((b, i) => (
        <g key={i}>
          <path
            d={`M 0 0 Q ${f2(b.mid.x)} ${f2(b.mid.y)} ${f2(b.tip.x)} ${f2(b.tip.y)}`}
            fill="none"
            stroke={twig}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
          {b.forks.map((fk, j) => {
            const cx = b.tip.x + fk.x;
            const cy = b.tip.y + fk.y;
            return (
              <g key={j}>
                <path
                  d={`M ${f2(b.tip.x)} ${f2(b.tip.y)} L ${f2(cx)} ${f2(cy)}`}
                  stroke={twig}
                  strokeWidth={0.75}
                  strokeLinecap="round"
                />
                {Array.from({ length: rangeInt(rng, 3, 5) }, (_, k) => {
                  const p = polar(range(rng, 0.6, 3.4), rng() * 360);
                  return (
                    <circle
                      key={k}
                      cx={f2(cx + p.x)}
                      cy={f2(cy + p.y)}
                      r={f2(range(rng, 1.5, 2.5))}
                      fill={shade(colors.petal, k % 2 ? -0.06 : 0.04)}
                      stroke={stroke}
                      strokeWidth={0.4}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
};

export default registerFlower({
  id: 'babysbreath',
  name: "Baby's breath",
  category: 'filler',
  capabilities: ['petalColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#fdfbf6', '#ffffff', '#f4eee2', '#e8eef4', '#f9e9ee'],
  headRadius: 22,
  hit: { cy: -22, r: 30 },
  defaults: {
    colors: { petal: '#fdfbf6', accent: '#fdfbf6', stem: '#8b9c7a' },
    size: 1,
    stemLength: 1.1,
  },
  stem: { thickness: 0.65, leaves: 'none', curve: -0.36 },
  Head,
});
