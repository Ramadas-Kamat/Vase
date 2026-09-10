/**
 * The single source of truth.
 *
 * `doc` is immutable: every action produces a new document. History is a plain
 * past/future stack of whole documents — at 40 flowers a document is a few KB,
 * so snapshotting is far simpler than diffing and cheap enough to keep 80 deep.
 *
 * COALESCING: continuous edits (dragging a stem, sweeping a slider) pass a
 * `coalesceKey`. Repeats of the same key inside COALESCE_MS mutate the present
 * without pushing another history entry, so one drag is one undo step rather
 * than two hundred.
 */
// Must come first: the initial state builds a preset, which needs a populated
// registry. See catalog/index.ts.
import '../catalog';
import { create } from 'zustand';
import type { Doc, Flower, Material, Pattern, Theme, VaseState } from '../types';
import { LIMITS, makeFlower, normalizeDoc } from '../lib/normalize';
import { clamp } from '../lib/geom';
import { allFlowerTypes, allVaseTypes, getVaseTypeOrFirst } from '../catalog/registry';
import { DEPTH_BOUNDS } from '../render/vaseGeometry';
import { PRESETS, defaultDoc } from '../presets';
import { makeRng, newSeed, pick, range, rangeInt } from '../lib/rng';

const COALESCE_MS = 650;

export interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'warn';
}

interface VaseSlice {
  doc: Doc;
  selectedId: string | null;
  past: Doc[];
  future: Doc[];
  notice: Notice | null;

  // --- selection -----------------------------------------------------------
  select: (id: string | null) => void;

  // --- vase ----------------------------------------------------------------
  setVase: (patch: Partial<VaseState>, coalesceKey?: string) => void;
  setVaseShape: (shapeId: string) => void;
  setMaterial: (material: Material) => void;
  setPattern: (pattern: Pattern) => void;

  // --- flowers -------------------------------------------------------------
  addFlower: (typeId: string, u?: number, depth?: number) => string | null;
  removeFlower: (id: string) => void;
  duplicateFlower: (id: string) => void;
  updateFlower: (id: string, patch: Partial<Flower>, coalesceKey?: string) => void;
  moveFlower: (id: string, u: number, depth: number) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  reseed: (id: string) => void;

  // --- document ------------------------------------------------------------
  setTheme: (theme: Theme) => void;
  loadDoc: (doc: Doc, options?: { resetHistory?: boolean }) => void;
  applyPreset: (presetId: string) => void;
  randomize: () => void;
  clearFlowers: () => void;

  // --- history -------------------------------------------------------------
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // --- transient UI --------------------------------------------------------
  notify: (text: string, tone?: 'info' | 'warn') => void;
  dismissNotice: () => void;
}

// Coalescing bookkeeping lives outside the store: it is scheduling state, not
// application state, and must not be snapshotted into history.
let lastKey: string | null = null;
let lastAt = 0;
let noticeSeq = 0;

export const useVase = create<VaseSlice>((set, get) => {
  /** Push a new document, respecting coalescing. */
  const commit = (next: Doc, coalesceKey?: string): void => {
    const s = get();
    const now = Date.now();
    const coalesce = coalesceKey != null && coalesceKey === lastKey && now - lastAt < COALESCE_MS;
    lastKey = coalesceKey ?? null;
    lastAt = now;
    set({
      doc: next,
      past: coalesce ? s.past : [...s.past, s.doc].slice(-LIMITS.historyDepth),
      future: [],
    });
  };

  /** Mutate the document without creating a history entry. */
  const silent = (next: Doc): void => {
    lastKey = null;
    set({ doc: next });
  };

  const patchFlowers = (
    next: (flowers: Flower[]) => Flower[],
    coalesceKey?: string,
  ): void => {
    const { doc } = get();
    commit({ ...doc, flowers: next(doc.flowers) }, coalesceKey);
  };

  const zOf = (f: Flower): number => f.z ?? f.depth;

  return {
    doc: defaultDoc(),
    selectedId: null,
    past: [],
    future: [],
    notice: null,

    select: (id) => set({ selectedId: id }),

    setVase: (patch, coalesceKey) => {
      const { doc } = get();
      commit({ ...doc, vase: { ...doc.vase, ...patch } }, coalesceKey);
    },

    /**
     * Switching shape also adopts that shape's default colours and material —
     * a terrazzo pattern chosen for a square vase rarely suits a fishbowl, and
     * carrying it over made every shape look like a mistake.
     */
    setVaseShape: (shapeId) => {
      const { doc } = get();
      const type = getVaseTypeOrFirst(shapeId);
      commit({
        ...doc,
        vase: {
          ...doc.vase,
          shapeId: type.id,
          color: type.defaults.color,
          accent: type.defaults.accent,
          material: type.defaults.material,
          pattern: type.defaults.pattern,
        },
      });
    },

    setMaterial: (material) => get().setVase({ material }),
    setPattern: (pattern) => get().setVase({ pattern }),

    addFlower: (typeId, u, depth) => {
      const { doc, notify } = get();
      if (doc.flowers.length >= LIMITS.hardCap) {
        notify(`That's the ${LIMITS.hardCap}-flower limit — remove one first.`, 'warn');
        return null;
      }
      const rng = makeRng(newSeed());
      const flower = makeFlower(
        typeId,
        u ?? range(rng, 0.2, 0.8),
        depth ?? range(rng, DEPTH_BOUNDS.min, DEPTH_BOUNDS.max),
      );
      if (!flower) {
        notify(`Unknown flower type "${typeId}".`, 'warn');
        return null;
      }
      commit({ ...doc, flowers: [...doc.flowers, flower] });
      set({ selectedId: flower.id });
      if (doc.flowers.length + 1 === LIMITS.softCap + 1) {
        notify('Getting full — past 24 stems it starts to read as a hedge.', 'info');
      }
      return flower.id;
    },

    removeFlower: (id) => {
      const { doc, selectedId } = get();
      if (!doc.flowers.some((f) => f.id === id)) return;
      commit({ ...doc, flowers: doc.flowers.filter((f) => f.id !== id) });
      if (selectedId === id) set({ selectedId: null });
    },

    duplicateFlower: (id) => {
      const { doc, notify } = get();
      const src = doc.flowers.find((f) => f.id === id);
      if (!src) return;
      if (doc.flowers.length >= LIMITS.hardCap) {
        notify(`That's the ${LIMITS.hardCap}-flower limit — remove one first.`, 'warn');
        return;
      }
      const copy = makeFlower(src.typeId, clamp(src.u + 0.07, 0, 1), src.depth);
      if (!copy) return;
      const clone: Flower = {
        ...copy,
        lean: src.lean,
        size: src.size,
        stemLength: src.stemLength,
        colors: { ...src.colors },
      };
      commit({ ...doc, flowers: [...doc.flowers, clone] });
      set({ selectedId: clone.id });
    },

    updateFlower: (id, patch, coalesceKey) => {
      patchFlowers(
        (flowers) => flowers.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        coalesceKey,
      );
    },

    moveFlower: (id, u, depth) => {
      patchFlowers(
        (flowers) =>
          flowers.map((f) =>
            f.id === id
              ? {
                  ...f,
                  u: clamp(u, 0, 1),
                  depth: clamp(depth, DEPTH_BOUNDS.min, DEPTH_BOUNDS.max),
                }
              : f,
          ),
        `move:${id}`,
      );
    },

    bringToFront: (id) => {
      const { doc } = get();
      const max = Math.max(...doc.flowers.map(zOf), 0);
      get().updateFlower(id, { z: max + 0.02 });
    },

    sendToBack: (id) => {
      const { doc } = get();
      const min = Math.min(...doc.flowers.map(zOf), 1);
      get().updateFlower(id, { z: min - 0.02 });
    },

    reseed: (id) => get().updateFlower(id, { seed: newSeed() }),

    // Theme is stored in the document so it travels in share links, but it is
    // not an arrangement edit — undo should not walk back through theme flips.
    setTheme: (theme) => silent({ ...get().doc, theme }),

    loadDoc: (doc, options) => {
      const { doc: current } = get();
      if (options?.resetHistory) {
        lastKey = null;
        set({ doc, past: [], future: [], selectedId: null });
        return;
      }
      lastKey = null;
      set({
        doc,
        past: [...get().past, current].slice(-LIMITS.historyDepth),
        future: [],
        selectedId: null,
      });
    },

    applyPreset: (presetId) => {
      const preset = PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const { doc } = get();
      // Keep the user's theme; only the arrangement is being replaced.
      get().loadDoc({ ...preset.build(), theme: doc.theme });
      get().notify(`Loaded “${preset.name}”.`);
    },

    randomize: () => {
      const rng = makeRng(newSeed());
      const vaseType = pick(rng, allVaseTypes());
      const types = allFlowerTypes();
      const blooms = types.filter((t) => t.category === 'bloom');
      const fillers = types.filter((t) => t.category === 'filler');
      const count = rangeInt(rng, 5, 11);

      const specs: Flower[] = [];
      for (let i = 0; i < count; i += 1) {
        // Fillers go in first and sit at the back, which is how a real
        // arrangement is built up.
        const isFiller = i < 2 && fillers.length > 0;
        const type = pick(rng, isFiller ? fillers : blooms);
        const u = (i + 0.5) / count + range(rng, -0.06, 0.06);
        const depth = isFiller
          ? range(rng, DEPTH_BOUNDS.min, 0.35)
          : range(rng, 0.3, DEPTH_BOUNDS.max);
        const f = makeFlower(type.id, clamp(u, 0.06, 0.94), depth);
        if (!f) continue;
        specs.push({
          ...f,
          size: range(rng, 0.85, 1.2) * type.defaults.size,
          stemLength: range(rng, 0.85, 1.25) * type.defaults.stemLength,
          colors: { ...f.colors, petal: pick(rng, type.palette) },
        });
      }

      get().loadDoc({
        v: 1,
        theme: get().doc.theme,
        vase: {
          shapeId: vaseType.id,
          material: vaseType.defaults.material,
          pattern: vaseType.defaults.pattern,
          color: vaseType.defaults.color,
          accent: vaseType.defaults.accent,
          height: range(rng, 0.85, 1.2),
          width: range(rng, 0.85, 1.15),
        },
        flowers: specs,
      });
    },

    clearFlowers: () => {
      const { doc } = get();
      if (doc.flowers.length === 0) return;
      commit({ ...doc, flowers: [] });
      set({ selectedId: null });
    },

    undo: () => {
      const { past, future, doc } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      lastKey = null;
      set({
        doc: previous,
        past: past.slice(0, -1),
        future: [doc, ...future].slice(0, LIMITS.historyDepth),
        selectedId: null,
      });
    },

    redo: () => {
      const { past, future, doc } = get();
      const next = future[0];
      if (!next) return;
      lastKey = null;
      set({
        doc: next,
        past: [...past, doc].slice(-LIMITS.historyDepth),
        future: future.slice(1),
        selectedId: null,
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    notify: (text, tone = 'info') => {
      noticeSeq += 1;
      set({ notice: { id: noticeSeq, text, tone } });
    },

    dismissNotice: () => set({ notice: null }),
  };
});

/** Replace the whole document from outside React (boot, import, share link). */
export function hydrate(raw: unknown): { dropped: number } {
  const { doc, dropped } = normalizeDoc(raw);
  useVase.getState().loadDoc(doc, { resetHistory: true });
  return { dropped };
}

/** Test hook: reset module-level coalescing state between cases. */
export function __resetCoalescing(): void {
  lastKey = null;
  lastAt = 0;
}
