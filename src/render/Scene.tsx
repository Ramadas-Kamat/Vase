/**
 * The canvas. Owns all pointer interaction inside the artwork.
 *
 * Layer order, back to front (see VaseArt for why the vase is split in two):
 *   background hit rect → ground + shadow → vase interior → flowers (z-sorted)
 *   → vase body/water/lip → petal bursts
 *
 * DRAG MODEL
 *   Moving a flower uses pointer DELTAS, not absolute position. The rim ellipse
 *   is only ~60 user units tall, so mapping absolute y to depth is far too
 *   twitchy; deltas let horizontal movement track the cursor exactly while
 *   vertical movement adjusts depth gently. Dropping from the tray, by contrast,
 *   uses absolute mapping via `geo.fromPoint` — there the cursor position IS the
 *   intent.
 */
import {
  useCallback,
  useRef,
  useState,
  type FC,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { Doc, Flower } from '../types';
import { getFlowerType } from '../catalog/registry';
import { SCENE, type VaseGeometry } from './vaseGeometry';
import { Ground, VaseBodyLayer, VaseDefs, VaseInterior } from './VaseArt';
import { Stem } from './Stem';
import { PetalBurst, type Burst } from './Petals';
import { useVase } from '../store/store';
import { clamp } from '../lib/geom';

/** Vertical drag distance that spans the full depth range, in rim-height units. */
const DEPTH_DRAG_GAIN = 3.2;
/** Movement below this (in user units) is treated as a click, not a drag. */
const DRAG_THRESHOLD = 2.5;

interface SceneProps {
  doc: Doc;
  geo: VaseGeometry;
  selectedId: string | null;
  exiting: ReadonlySet<string>;
  bursts: Burst[];
  svgRef: RefObject<SVGSVGElement | null>;
  onRequestRemove: (id: string) => void;
  onFlowerContext: (payload: { id: string; clientX: number; clientY: number }) => void;
}

type Drag =
  | {
      kind: 'move';
      id: string;
      u0: number;
      depth0: number;
      x0: number;
      y0: number;
      moved: boolean;
    }
  | { kind: 'lean'; id: string; lean0: number; x0: number };

const zOf = (f: Flower) => f.z ?? f.depth;

export const Scene: FC<SceneProps> = ({
  doc,
  geo,
  selectedId,
  exiting,
  bursts,
  svgRef,
  onRequestRemove,
  onFlowerContext,
}) => {
  const select = useVase((s) => s.select);
  const moveFlower = useVase((s) => s.moveFlower);
  const updateFlower = useVase((s) => s.updateFlower);

  const drag = useRef<Drag | null>(null);
  const [removeArmed, setRemoveArmed] = useState(false);

  /** Client coordinates → SVG user units, robust to letterboxing and zoom. */
  const toScene = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return { x: 0, y: 0 };
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
    [svgRef],
  );

  /** True when releasing here should delete the flower. */
  const isRemoveZone = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return false;
      const outsideBox =
        clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
      const belowGround = toScene(clientX, clientY).y > SCENE.groundY - 12;
      return outsideBox || belowGround;
    },
    [svgRef, toScene],
  );

  const handleGrab = useCallback(
    (event: ReactPointerEvent, id: string) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const flower = doc.flowers.find((f) => f.id === id);
      if (!flower) return;
      select(id);
      const local = toScene(event.clientX, event.clientY);
      drag.current = {
        kind: 'move',
        id,
        u0: flower.u,
        depth0: flower.depth,
        x0: local.x,
        y0: local.y,
        moved: false,
      };
      svgRef.current?.setPointerCapture(event.pointerId);
    },
    [doc.flowers, select, toScene, svgRef],
  );

  const handleLeanGrab = useCallback(
    (event: ReactPointerEvent, id: string) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const flower = doc.flowers.find((f) => f.id === id);
      if (!flower) return;
      drag.current = {
        kind: 'lean',
        id,
        lean0: flower.lean,
        x0: toScene(event.clientX, event.clientY).x,
      };
      svgRef.current?.setPointerCapture(event.pointerId);
    },
    [doc.flowers, toScene, svgRef],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const state = drag.current;
      if (!state) return;
      const local = toScene(event.clientX, event.clientY);

      if (state.kind === 'lean') {
        // 0.42°/unit keeps the full ±26° range inside a comfortable wrist sweep.
        updateFlower(state.id, { lean: clamp(state.lean0 + (local.x - state.x0) * 0.42, -26, 26) }, `lean:${state.id}`);
        return;
      }

      const dx = local.x - state.x0;
      const dy = local.y - state.y0;
      if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      state.moved = true;

      const armed = isRemoveZone(event.clientX, event.clientY);
      if (armed !== removeArmed) setRemoveArmed(armed);

      const depth = state.depth0 + dy / (geo.rimRy * DEPTH_DRAG_GAIN);
      // u-sensitivity tracks the width actually available at this depth, so the
      // stem stays under the cursor instead of racing ahead of it.
      const u = state.u0 + dx / (2 * geo.availableHalfWidth(depth));
      moveFlower(state.id, u, depth);
    },
    [toScene, updateFlower, isRemoveZone, removeArmed, geo, moveFlower],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent) => {
      const state = drag.current;
      drag.current = null;
      if (!state) return;
      svgRef.current?.releasePointerCapture?.(event.pointerId);
      if (state.kind === 'move' && state.moved && isRemoveZone(event.clientX, event.clientY)) {
        onRequestRemove(state.id);
      }
      if (removeArmed) setRemoveArmed(false);
    },
    [svgRef, isRemoveZone, onRequestRemove, removeArmed],
  );

  const handleContext = useCallback(
    (event: ReactMouseEvent, id: string) => {
      event.preventDefault();
      event.stopPropagation();
      select(id);
      onFlowerContext({ id, clientX: event.clientX, clientY: event.clientY });
    },
    [select, onFlowerContext],
  );

  const ordered = [...doc.flowers].sort((a, b) => zOf(a) - zOf(b));

  return (
    <svg
      ref={svgRef}
      className="scene"
      viewBox={`0 0 ${SCENE.w} ${SCENE.h}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`A ${doc.vase.material} ${geo.type.name.toLowerCase()} vase holding ${doc.flowers.length} ${doc.flowers.length === 1 ? 'flower' : 'flowers'}.`}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(e) => e.preventDefault()}
    >
      <VaseDefs geo={geo} vase={doc.vase} />

      {/* Background: clicking empty canvas clears the selection. */}
      <rect
        x={0}
        y={0}
        width={SCENE.w}
        height={SCENE.h}
        fill="transparent"
        onPointerDown={() => select(null)}
        data-export="skip"
      />

      <Ground geo={geo} vase={doc.vase} />
      <VaseInterior geo={geo} vase={doc.vase} />

      <g className="flowers">
        {ordered.map((flower) => {
          const type = getFlowerType(flower.typeId);
          if (!type) return null;
          return (
            <Stem
              key={flower.id}
              flower={flower}
              type={type}
              geo={geo}
              selected={flower.id === selectedId}
              exiting={exiting.has(flower.id)}
              onGrab={handleGrab}
              onLeanGrab={handleLeanGrab}
              onContext={handleContext}
            />
          );
        })}
      </g>

      <VaseBodyLayer geo={geo} vase={doc.vase} />

      {bursts.map((burst) => (
        <PetalBurst key={burst.id} burst={burst} />
      ))}

      {doc.flowers.length === 0 && (
        <text
          className="empty-hint"
          x={SCENE.cx}
          y={geo.rimY - 74}
          textAnchor="middle"
          data-export="skip"
        >
          Drag a flower here from the left
        </text>
      )}

      {removeArmed && (
        <g data-export="skip">
          <rect
            x={SCENE.cx - 118}
            y={SCENE.groundY + 24}
            width={236}
            height={38}
            rx={19}
            fill="var(--danger)"
            opacity={0.94}
          />
          <text className="remove-hint" x={SCENE.cx} y={SCENE.groundY + 49} textAnchor="middle">
            Release to remove
          </text>
        </g>
      )}
    </svg>
  );
};
