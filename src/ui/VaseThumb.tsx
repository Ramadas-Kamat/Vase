/**
 * Vase-picker thumbnail. Uses the same `buildBodyPath` as the scene, so a new
 * vase's silhouette in the picker is guaranteed to match what it renders as.
 */
import type { FC } from 'react';
import type { VaseType } from '../types';
import { buildBodyPath } from '../render/vaseGeometry';
import { shade } from '../lib/color';

const BOX = { w: 46, h: 52 } as const;

export const VaseThumb: FC<{ type: VaseType; color: string }> = ({ type, color }) => {
  const { d, rimRx, rimRy } = buildBodyPath({
    profile: type.profile,
    cx: BOX.w / 2,
    baseY: BOX.h - 4,
    height: BOX.h - 12,
    halfWidth: BOX.w / 2 - 3,
    samples: 22,
  });

  return (
    <svg
      className="vase-thumb"
      viewBox={`0 0 ${BOX.w} ${BOX.h}`}
      width={BOX.w}
      height={BOX.h}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx={BOX.w / 2}
        cy={8}
        rx={rimRx}
        ry={rimRy}
        fill={shade(color, -0.4)}
      />
      <path d={d} fill={color} stroke={shade(color, -0.3)} strokeWidth={0.9} />
    </svg>
  );
};
