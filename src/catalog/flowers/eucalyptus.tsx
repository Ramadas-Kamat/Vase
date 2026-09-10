import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter, rangeInt } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';
import { cubicPoint, cubicAngle, f2 } from '../../lib/geom';

/** Filler greenery: round leaves alternating along a bowed twig. */
const Head: FC<HeadProps> = ({ colors, seed }) => {
  const rng = makeRng(seed);
  const n = rangeInt(rng, 9, 12);
  const bow = jitter(rng, 6);
  const stroke = outlineFor(colors.petal);

  const p0 = { x: 0, y: 0 };
  const p1 = { x: bow + 4, y: -16 };
  const p2 = { x: bow - 5, y: -34 };
  const p3 = { x: bow * 0.5, y: -52 };

  const leaves = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.6) / (n + 0.4);
    const pt = cubicPoint(p0, p1, p2, p3, t);
    const ang = cubicAngle(p0, p1, p2, p3, t);
    const side = i % 2 === 0 ? -1 : 1;
    return {
      ...pt,
      // Leaf splays away from the twig, drooping slightly with height.
      rot: ang + 90 + side * (62 + jitter(rng, 10)) - t * 8,
      r: (5.6 - t * 1.9) * (0.88 + rng() * 0.26),
      tone: i % 3 === 0 ? -0.14 : i % 3 === 1 ? 0.07 : -0.02,
    };
  });

  return (
    <g>
      <path
        d={`M ${f2(p0.x)} ${f2(p0.y)} C ${f2(p1.x)} ${f2(p1.y)} ${f2(p2.x)} ${f2(p2.y)} ${f2(p3.x)} ${f2(p3.y)}`}
        fill="none"
        stroke={shade(colors.stem, -0.12)}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {leaves.map((lf, i) => (
        <ellipse
          key={i}
          rx={lf.r}
          ry={lf.r * 0.86}
          fill={shade(colors.petal, lf.tone)}
          stroke={stroke}
          strokeWidth={0.6}
          transform={`translate(${f2(lf.x)} ${f2(lf.y)}) rotate(${f2(lf.rot)}) translate(${f2(lf.r * 0.95)} 0)`}
        />
      ))}
    </g>
  );
};

export default registerFlower({
  id: 'eucalyptus',
  name: 'Eucalyptus',
  category: 'filler',
  // No accent colour: there is no centre or stamen to tint.
  capabilities: ['petalColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#9db79f', '#7f9c86', '#b6c7ae', '#6f8a76', '#c5d1bd'],
  headRadius: 18,
  hit: { cy: -26, r: 26 },
  defaults: {
    colors: { petal: '#9db79f', accent: '#9db79f', stem: '#83957c' },
    size: 1,
    stemLength: 1.16,
  },
  stem: { thickness: 0.8, leaves: 'none', curve: 0.4 },
  Head,
});
