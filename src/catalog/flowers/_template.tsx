/**
 * TEMPLATE — copy this file to add a new flower type.
 *
 * 1. Copy to `catalog/flowers/my-flower.tsx`
 * 2. Give it a unique `id`
 * 3. Draw the bloom in `Head`
 * 4. Add `import './my-flower';` to `catalog/flowers/index.ts`
 *
 * That is the whole job. The tray button, the properties-panel controls, the
 * stem, the leaves, the sway animation, placement in the vase, z-ordering,
 * export and share links all come for free:
 *
 *  - The TRAY is generated from the registry, so your flower appears in it.
 *  - The PROPERTIES PANEL is generated from `capabilities`, so listing
 *    'petalColor' gives you a colour picker wired to `colors.petal`. Omit a
 *    capability and its control disappears for this flower only.
 *  - The STEM is drawn by `render/Stem.tsx` from your `stem` spec. You only draw
 *    the bloom.
 *
 * COORDINATE SYSTEM for `Head`:
 *   (0, 0) is where the stem meets the flower. Negative y is UP. Draw at
 *   roughly 20–40 units so you sit in the same visual range as the stock types;
 *   the user's size slider scales you from there.
 */
import type { FC } from 'react';
import { registerFlower } from '../registry';
import type { HeadProps } from '../../types';
import { makeRng, jitter } from '../../lib/rng';
import { shade, outlineFor } from '../../lib/color';
import { petalPath, radial } from './petals';

const Head: FC<HeadProps> = ({ colors, seed }) => {
  // Always derive variation from `seed` — never Math.random() — so the flower
  // renders identically on reload and travels correctly in a share link.
  const rng = makeRng(seed);
  const r = 24;
  const stroke = outlineFor(colors.petal);
  const spin = jitter(rng, 24);

  return (
    <g transform={`translate(0 ${-r * 0.8})`}>
      {radial(6, spin).map((angle, i) => (
        <path
          key={i}
          d={petalPath(r * 0.5, r, 0.8)}
          fill={shade(colors.petal, i % 2 ? -0.06 : 0.04)}
          stroke={stroke}
          strokeWidth={0.9}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle r={r * 0.22} fill={colors.accent} stroke={stroke} strokeWidth={0.8} />
    </g>
  );
};

export default registerFlower({
  id: 'template-flower',
  name: 'Template',
  category: 'bloom',
  capabilities: ['petalColor', 'accentColor', 'stemColor', 'size', 'stemLength', 'lean'],
  palette: ['#e2536b', '#f2a0b4', '#f7d774', '#9fc8e8', '#ffffff'],
  headRadius: 24,
  hit: { cy: -19, r: 26 },
  defaults: {
    colors: { petal: '#e2536b', accent: '#f4c96b', stem: '#5d7f52' },
    size: 1,
    stemLength: 1,
  },
  stem: { thickness: 1, leaves: 'pair', curve: 0.2 },
  Head,
});
