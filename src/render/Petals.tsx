/**
 * Petal-fall particles, spawned when a flower is removed.
 *
 * Pure CSS keyframes driven by per-petal custom properties — no rAF, no state
 * updates per frame. The burst is unmounted by a timer in `useRemoveFlourish`.
 */
import type { CSSProperties, FC } from 'react';
import { petalPath } from '../catalog/flowers/petals';
import { shade } from '../lib/color';
import { makeRng, range } from '../lib/rng';

export interface Burst {
  id: number;
  x: number;
  y: number;
  color: string;
  seed: number;
}

const PETALS_PER_BURST = 9;

export const PetalBurst: FC<{ burst: Burst }> = ({ burst }) => {
  const rng = makeRng(burst.seed);
  const petals = Array.from({ length: PETALS_PER_BURST }, (_, i) => ({
    dx: range(rng, -46, 46),
    dy: range(rng, 90, 190),
    rot: range(rng, -320, 320),
    delay: i * 0.035 + range(rng, 0, 0.08),
    scale: range(rng, 0.62, 1.18),
    tone: range(rng, -0.18, 0.16),
    spin: range(rng, 0, 360),
  }));

  return (
    <g transform={`translate(${burst.x} ${burst.y})`} data-export="skip">
      {petals.map((p, i) => (
        <path
          key={i}
          className="petal-fall"
          d={petalPath(4.4, 9.4, 1)}
          fill={shade(burst.color, p.tone)}
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              '--spin': `${p.spin}deg`,
              '--scale': p.scale,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </g>
  );
};
