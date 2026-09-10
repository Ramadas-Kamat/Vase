/**
 * Tray / menu thumbnail for a flower type.
 *
 * Renders the type's real `Head` component rather than a separate icon set, so a
 * newly added flower gets a correct thumbnail for free — and the tray can never
 * drift out of sync with the artwork.
 *
 * `hit.cy` and `hit.r` are reused as the framing hint: translate the bloom
 * centre to the origin, then scale so the bloom fills the box.
 */
import type { FC } from 'react';
import type { FlowerColors, FlowerType } from '../types';

const BOX = 30;

interface FlowerThumbProps {
  type: FlowerType;
  colors?: FlowerColors;
  seed?: number;
  size?: number;
}

export const FlowerThumb: FC<FlowerThumbProps> = ({ type, colors, seed = 7, size = 44 }) => {
  const scale = (BOX * 0.92) / Math.max(type.hit.r, 12);
  return (
    <svg
      className="thumb"
      width={size}
      height={size}
      viewBox={`${-BOX} ${-BOX} ${BOX * 2} ${BOX * 2}`}
      aria-hidden="true"
      focusable="false"
    >
      <g transform={`scale(${scale}) translate(0 ${-type.hit.cy})`}>
        <type.Head size={1} colors={colors ?? type.defaults.colors} seed={seed} />
      </g>
    </svg>
  );
};
