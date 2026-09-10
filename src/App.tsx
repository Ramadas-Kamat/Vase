/**
 * Application shell: layout, cross-cutting effects, and the two gestures that
 * span more than one component (tray→scene placement, and keyboard shortcuts).
 *
 * WHY GEOMETRY LIVES HERE: `Scene`, `useRemoveFlourish` and the placement
 * gesture all need the same derived vase geometry. Building it once here and
 * passing it down keeps a single source of truth and avoids rebuilding it three
 * times per render.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useVase } from './store/store';
import { getFlowerType, getVaseTypeOrFirst } from './catalog/registry';
import { buildVaseGeometry } from './render/vaseGeometry';
import { setSwayEnabled } from './render/sway';
import { Scene } from './render/Scene';
import { Toolbar } from './ui/Toolbar';
import { Tray } from './ui/Tray';
import { Properties } from './ui/Properties';
import { Toast } from './ui/Toast';
import { ContextMenu, type ContextTarget } from './ui/ContextMenu';
import { FlowerThumb } from './ui/FlowerThumb';
import { useRemoveFlourish } from './ui/useRemoveFlourish';
import { saveDocDebounced } from './persistence';
import { clamp } from './lib/geom';

/** Pointer travel that separates a click from a drag, in CSS pixels. */
const DRAG_SLOP = 5;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Ghost {
  typeId: string;
  x: number;
  y: number;
}

export default function App() {
  const doc = useVase((s) => s.doc);
  const selectedId = useVase((s) => s.selectedId);
  const addFlower = useVase((s) => s.addFlower);
  const select = useVase((s) => s.select);
  const undo = useVase((s) => s.undo);
  const redo = useVase((s) => s.redo);
  const updateFlower = useVase((s) => s.updateFlower);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [motion, setMotion] = useState(() => !prefersReducedMotion());
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null);

  const geo = useMemo(
    () => buildVaseGeometry(doc.vase, getVaseTypeOrFirst(doc.vase.shapeId)),
    [doc.vase],
  );
  // The placement gesture runs in window listeners that outlive a render, so it
  // reads geometry through a ref rather than closing over a stale value.
  const geoRef = useRef(geo);
  geoRef.current = geo;

  const { exiting, bursts, requestRemove } = useRemoveFlourish(doc, geo, motion);

  // --- cross-cutting effects ------------------------------------------------

  useEffect(() => {
    document.documentElement.dataset.theme = doc.theme;
  }, [doc.theme]);

  useEffect(() => {
    setSwayEnabled(motion);
    document.documentElement.dataset.motion = motion ? 'on' : 'off';
  }, [motion]);

  useEffect(() => {
    saveDocDebounced(doc);
  }, [doc]);

  // --- keyboard ------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never hijack typing in a control.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === 'Escape') {
        select(null);
        setContextTarget(null);
        return;
      }
      if (!selectedId) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        requestRemove(selectedId);
        return;
      }

      const flower = doc.flowers.find((f) => f.id === selectedId);
      if (!flower) return;
      const fine = event.shiftKey ? 0.005 : 0.02;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          updateFlower(selectedId, { u: clamp(flower.u - fine, 0, 1) }, `u:${selectedId}`);
          break;
        case 'ArrowRight':
          event.preventDefault();
          updateFlower(selectedId, { u: clamp(flower.u + fine, 0, 1) }, `u:${selectedId}`);
          break;
        case 'ArrowUp':
          event.preventDefault();
          updateFlower(selectedId, { depth: clamp(flower.depth - fine, 0, 1) }, `depth:${selectedId}`);
          break;
        case 'ArrowDown':
          event.preventDefault();
          updateFlower(selectedId, { depth: clamp(flower.depth + fine, 0, 1) }, `depth:${selectedId}`);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [doc.flowers, selectedId, undo, redo, select, requestRemove, updateFlower]);

  // --- tray → scene placement ----------------------------------------------

  const startPlacing = useCallback(
    (typeId: string, event: ReactPointerEvent) => {
      if (event.button !== 0) return;
      // Stops the browser turning the gesture into a text/image drag.
      event.preventDefault();

      const origin = { x: event.clientX, y: event.clientY };
      let moved = false;
      setGhost({ typeId, x: origin.x, y: origin.y });

      const onMove = (e: PointerEvent) => {
        if (!moved && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > DRAG_SLOP) {
          moved = true;
        }
        setGhost({ typeId, x: e.clientX, y: e.clientY });
      };

      const onUp = (e: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        setGhost(null);

        const svg = svgRef.current;
        const rect = svg?.getBoundingClientRect();
        const inside =
          !!rect &&
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        // A tap (no travel) auto-places; a drag into the canvas places under the
        // cursor; a drag that ends outside the canvas is a cancelled gesture.
        if (!moved) {
          addFlower(typeId);
          return;
        }
        if (!inside || !svg) return;

        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        const { u, depth } = geoRef.current.fromPoint(point.x, point.y);
        addFlower(typeId, u, depth);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [addFlower],
  );

  const ghostType = ghost ? getFlowerType(ghost.typeId) : null;

  return (
    <div className="app">
      <Toolbar svgRef={svgRef} motion={motion} onToggleMotion={() => setMotion((m) => !m)} />

      <main className="workspace">
        <Tray
          onStartPlacing={startPlacing}
          onQuickAdd={(typeId) => addFlower(typeId)}
          activeTypeId={ghost?.typeId ?? null}
        />

        <div className="canvas">
          <Scene
            doc={doc}
            geo={geo}
            selectedId={selectedId}
            exiting={exiting}
            bursts={bursts}
            svgRef={svgRef}
            onRequestRemove={requestRemove}
            onFlowerContext={setContextTarget}
          />
        </div>

        <Properties onRequestRemove={requestRemove} />
      </main>

      {ghost && ghostType && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <FlowerThumb type={ghostType} size={62} />
        </div>
      )}

      {contextTarget && (
        <ContextMenu
          target={contextTarget}
          onClose={() => setContextTarget(null)}
          onRequestRemove={requestRemove}
        />
      )}

      <Toast />
    </div>
  );
}
