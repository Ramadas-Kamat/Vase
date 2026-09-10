/**
 * One flower: stem, foliage, bloom, hit targets and selection affordances.
 *
 * Transform nesting matters here and is deliberate:
 *
 *   <g placement>   translate to the rim anchor + perspective scale  (React)
 *     <g sway>      rotate about the anchor, written by the rAF loop (NOT React)
 *       <g lean>    the user's lean angle                            (React)
 *         <g enter> CSS-only mount/unmount animation                 (CSS)
 *
 * The sway group is the only element the animation loop touches, and it has no
 * React-controlled `transform`. The enter group has no `transform` attribute at
 * all, because a CSS `transform` would silently override one.
 */
import { useCallback, type FC, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { Flower, FlowerType } from '../types';
import type { VaseGeometry } from './vaseGeometry';
import { registerSway, swayAmplitude } from './sway';
import { leafPath } from '../catalog/flowers/petals';
import { shade } from '../lib/color';
import { cubicAngle, cubicPoint, f2, type Point } from '../lib/geom';
import { makeRng, jitter } from '../lib/rng';

export interface StemProps {
  flower: Flower;
  type: FlowerType;
  geo: VaseGeometry;
  selected: boolean;
  exiting: boolean;
  onGrab: (event: ReactPointerEvent, id: string) => void;
  onLeanGrab: (event: ReactPointerEvent, id: string) => void;
  onContext: (event: ReactMouseEvent, id: string) => void;
}

/** Base visible stem length in user units before the flower's multiplier. */
const BASE_LENGTH = 104;

const LEAF_LAYOUT: Record<FlowerType['stem']['leaves'], { t: number; side: number }[]> = {
  none: [],
  pair: [
    { t: 0.52, side: -1 },
    { t: 0.66, side: 1 },
  ],
  alternate: [
    { t: 0.44, side: -1 },
    { t: 0.6, side: 1 },
    { t: 0.75, side: -1 },
  ],
};

export const Stem: FC<StemProps> = ({
  flower: f,
  type,
  geo,
  selected,
  exiting,
  onGrab,
  onLeanGrab,
  onContext,
}) => {
  const rng = makeRng(f.seed ^ 0x9e37);
  const anchor = geo.anchorAt(f.u, f.depth);
  const length = (BASE_LENGTH + type.headRadius * 0.5) * f.stemLength;
  const bow = type.stem.curve * length * 0.15 + jitter(rng, length * 0.03);

  // Stem control points, local to the anchor. p0 sits inside the vase so the
  // stem reads as seated in water rather than balanced on the rim.
  const p0: Point = { x: jitter(rng, 3), y: geo.interiorDepth * 0.6 };
  const p1: Point = { x: bow * 0.1, y: -length * 0.1 };
  const p2: Point = { x: bow * 0.95, y: -length * 0.58 };
  const p3: Point = { x: bow, y: -length };

  const stemD = `M ${f2(p0.x)} ${f2(p0.y)} C ${f2(p1.x)} ${f2(p1.y)} ${f2(p2.x)} ${f2(p2.y)} ${f2(p3.x)} ${f2(p3.y)}`;
  const stemWidth = 3.1 * type.stem.thickness * (0.8 + f.size * 0.25);

  const leaves = LEAF_LAYOUT[type.stem.leaves].map((spec) => {
    const at = cubicPoint(p0, p1, p2, p3, spec.t);
    const tangent = cubicAngle(p0, p1, p2, p3, spec.t);
    const scale = (1.05 - spec.t * 0.3) * f.size;
    return {
      ...at,
      rot: tangent + 90 + spec.side * (54 + jitter(rng, 9)),
      scale,
    };
  });

  const headX = p3.x;
  const headY = p3.y;
  const hitCy = headY + type.hit.cy * f.size;
  const hitR = type.hit.r * f.size;

  const phase = ((f.seed % 4096) / 4096) * Math.PI * 2;
  const amp = swayAmplitude(f.stemLength, type.headRadius, type.stem.thickness);

  const swayRef = useCallback(
    (el: SVGGElement | null) => {
      registerSway(f.id, el, phase, amp);
    },
    [f.id, phase, amp],
  );

  const { Head } = type;

  return (
    <g
      className="stem-placement"
      transform={`translate(${f2(anchor.x)} ${f2(anchor.y)}) scale(${f2(anchor.scale)})`}
      data-flower-id={f.id}
    >
      <g ref={swayRef}>
        <g transform={`rotate(${f2(f.lean)})`}>
          <g className={exiting ? 'stem-body stem-exit' : 'stem-body stem-enter'}>
            <path
              d={stemD}
              fill="none"
              stroke={f.colors.stem}
              strokeWidth={stemWidth}
              strokeLinecap="round"
            />
            {/* Shading down one side of the stem, for a hint of roundness. */}
            <path
              d={stemD}
              fill="none"
              stroke={shade(f.colors.stem, -0.24)}
              strokeWidth={stemWidth * 0.34}
              strokeLinecap="round"
              transform={`translate(${f2(stemWidth * 0.28)} 0)`}
              opacity={0.6}
            />

            {leaves.map((lf, i) => (
              <g
                key={i}
                transform={`translate(${f2(lf.x)} ${f2(lf.y)}) rotate(${f2(lf.rot)}) scale(${f2(lf.scale)})`}
              >
                <path
                  d={leafPath(9, 26)}
                  fill={shade(f.colors.stem, i % 2 ? 0.1 : -0.05)}
                  stroke={shade(f.colors.stem, -0.3)}
                  strokeWidth={0.8}
                />
                <path
                  d={`M 0 0 L 0 ${f2(-24)}`}
                  stroke={shade(f.colors.stem, -0.22)}
                  strokeWidth={0.7}
                  opacity={0.7}
                />
              </g>
            ))}

            <g transform={`translate(${f2(headX)} ${f2(headY)}) scale(${f2(f.size)})`}>
              <Head size={f.size} colors={f.colors} seed={f.seed} />
            </g>

            {selected && (
              <g data-export="skip" className="selection">
                <circle
                  cx={headX}
                  cy={hitCy}
                  r={hitR + 5}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.6}
                  strokeDasharray="5 4"
                  opacity={0.9}
                />
                {/* Lean handle — drag left/right to tilt the stem. */}
                <g
                  className="lean-handle"
                  transform={`translate(${f2(headX + hitR + 16)} ${f2(hitCy)})`}
                  onPointerDown={(e) => onLeanGrab(e, f.id)}
                >
                  <circle r={9} fill="var(--panel)" stroke="var(--accent)" strokeWidth={1.6} />
                  <path
                    d="M -4.2 0 L 4.2 0 M -4.2 0 L -2 -2.2 M -4.2 0 L -2 2.2 M 4.2 0 L 2 -2.2 M 4.2 0 L 2 2.2"
                    stroke="var(--accent)"
                    strokeWidth={1.4}
                    fill="none"
                    strokeLinecap="round"
                  />
                </g>
              </g>
            )}

            {/* Invisible, generous hit targets. Kept last so they sit on top. */}
            <g
              className="stem-hit"
              onPointerDown={(e) => onGrab(e, f.id)}
              onContextMenu={(e) => onContext(e, f.id)}
              data-export="skip"
            >
              <path
                d={stemD}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(20, stemWidth * 4)}
                strokeLinecap="round"
                style={{ pointerEvents: 'stroke' }}
              />
              <circle cx={headX} cy={hitCy} r={hitR} fill="transparent" />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
};
