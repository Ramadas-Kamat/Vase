/**
 * State-model tests.
 *
 * The store is the only place in the app with real logic that isn't geometry or
 * paint, so it is where the tests are concentrated: history granularity, the
 * flower cap, and the invariants the renderer trusts (`u`/`depth` in range,
 * selection always pointing at a flower that exists).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import '../src/catalog';
import { __resetCoalescing, useVase } from '../src/store/store';
import { allFlowerTypes, allVaseTypes, getVaseTypeOrFirst } from '../src/catalog/registry';
import { LIMITS } from '../src/lib/normalize';
import { DEPTH_BOUNDS } from '../src/render/vaseGeometry';
import { PRESETS } from '../src/presets';
import type { Doc } from '../src/types';

const store = () => useVase.getState();
const rose = allFlowerTypes()[0]!.id;

/** An empty document, so each test starts from a known, minimal state. */
const emptyDoc = (): Doc => ({
  v: 1,
  theme: 'light',
  vase: {
    shapeId: allVaseTypes()[0]!.id,
    material: 'matte',
    pattern: 'none',
    color: '#d9dcd6',
    accent: '#b39c74',
    height: 1,
    width: 1,
  },
  flowers: [],
});

beforeEach(() => {
  __resetCoalescing();
  store().loadDoc(emptyDoc(), { resetHistory: true });
});

describe('adding flowers', () => {
  it('adds, selects, and records one history step', () => {
    const id = store().addFlower(rose);
    expect(id).not.toBeNull();
    expect(store().doc.flowers).toHaveLength(1);
    expect(store().selectedId).toBe(id);
    expect(store().past).toHaveLength(1);
  });

  it('seats a new flower inside the usable rim band', () => {
    for (let i = 0; i < 12; i += 1) store().addFlower(rose);
    for (const f of store().doc.flowers) {
      expect(f.u).toBeGreaterThanOrEqual(0);
      expect(f.u).toBeLessThanOrEqual(1);
      expect(f.depth).toBeGreaterThanOrEqual(DEPTH_BOUNDS.min);
      expect(f.depth).toBeLessThanOrEqual(DEPTH_BOUNDS.max);
      expect(f.lean).toBeGreaterThanOrEqual(LIMITS.lean.min);
      expect(f.lean).toBeLessThanOrEqual(LIMITS.lean.max);
    }
  });

  it('honours an explicit position', () => {
    const id = store().addFlower(rose, 0.31, 0.62);
    const f = store().doc.flowers.find((x) => x.id === id)!;
    expect(f.u).toBeCloseTo(0.31, 6);
    expect(f.depth).toBeCloseTo(0.62, 6);
  });

  it('refuses past the hard cap and says so', () => {
    for (let i = 0; i < LIMITS.hardCap; i += 1) expect(store().addFlower(rose)).not.toBeNull();
    const historyBefore = store().past.length;

    expect(store().addFlower(rose)).toBeNull();
    expect(store().doc.flowers).toHaveLength(LIMITS.hardCap);
    // A refused add must not burn an undo step.
    expect(store().past).toHaveLength(historyBefore);
    expect(store().notice?.tone).toBe('warn');
  });

  it('rejects an unknown type without mutating the document', () => {
    expect(store().addFlower('no-such-flower')).toBeNull();
    expect(store().doc.flowers).toHaveLength(0);
    expect(store().notice?.tone).toBe('warn');
  });

  it('gives every flower a distinct id', () => {
    for (let i = 0; i < 20; i += 1) store().addFlower(rose);
    const ids = store().doc.flowers.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('removing and duplicating', () => {
  it('removes and clears the selection', () => {
    const id = store().addFlower(rose)!;
    store().removeFlower(id);
    expect(store().doc.flowers).toHaveLength(0);
    expect(store().selectedId).toBeNull();
  });

  it('ignores removal of an id that is not there', () => {
    store().addFlower(rose);
    const before = store().past.length;
    store().removeFlower('ghost');
    expect(store().doc.flowers).toHaveLength(1);
    expect(store().past).toHaveLength(before);
  });

  it('copies appearance but not identity when duplicating', () => {
    const id = store().addFlower(rose, 0.4, 0.5)!;
    store().updateFlower(id, { size: 1.4, colors: { petal: '#112233', accent: '#445566', stem: '#778899' } });
    store().duplicateFlower(id);

    const [original, copy] = store().doc.flowers;
    expect(store().doc.flowers).toHaveLength(2);
    expect(copy!.id).not.toBe(original!.id);
    expect(copy!.size).toBe(1.4);
    expect(copy!.colors).toEqual(original!.colors);
    // Offset so the copy is visible rather than exactly behind the original.
    expect(copy!.u).not.toBe(original!.u);
    expect(store().selectedId).toBe(copy!.id);
  });

  it('clears every flower in one undoable step', () => {
    for (let i = 0; i < 5; i += 1) store().addFlower(rose);
    store().clearFlowers();
    expect(store().doc.flowers).toHaveLength(0);
    store().undo();
    expect(store().doc.flowers).toHaveLength(5);
  });

  it('does nothing when clearing an already-empty vase', () => {
    store().clearFlowers();
    expect(store().past).toHaveLength(0);
  });
});

describe('history', () => {
  it('undoes and redoes an add', () => {
    store().addFlower(rose);
    store().undo();
    expect(store().doc.flowers).toHaveLength(0);
    store().redo();
    expect(store().doc.flowers).toHaveLength(1);
  });

  it('drops the redo stack once a new edit lands', () => {
    store().addFlower(rose);
    store().undo();
    expect(store().canRedo()).toBe(true);
    store().addFlower(rose);
    expect(store().canRedo()).toBe(false);
  });

  it('is a no-op at either end of the stack', () => {
    expect(store().canUndo()).toBe(false);
    store().undo();
    store().redo();
    expect(store().doc.flowers).toHaveLength(0);
  });

  it('collapses a repeated coalesce key into one step', () => {
    const id = store().addFlower(rose)!;
    const before = store().past.length;
    for (let i = 0; i < 30; i += 1) {
      store().updateFlower(id, { size: 1 + i * 0.01 }, `size:${id}`);
    }
    expect(store().past).toHaveLength(before + 1);

    // And one undo returns to the pre-sweep value.
    store().undo();
    expect(store().doc.flowers[0]!.size).not.toBeCloseTo(1.29, 2);
  });

  it('keeps different coalesce keys separate', () => {
    const id = store().addFlower(rose)!;
    const before = store().past.length;
    store().updateFlower(id, { size: 1.2 }, `size:${id}`);
    store().updateFlower(id, { lean: 8 }, `lean:${id}`);
    store().updateFlower(id, { size: 1.3 }, `size:${id}`);
    expect(store().past).toHaveLength(before + 3);
  });

  it('never coalesces edits with no key', () => {
    const id = store().addFlower(rose)!;
    const before = store().past.length;
    store().updateFlower(id, { size: 1.2 });
    store().updateFlower(id, { size: 1.3 });
    expect(store().past).toHaveLength(before + 2);
  });

  it('collapses a drag into one step', () => {
    const id = store().addFlower(rose)!;
    const before = store().past.length;
    for (let i = 0; i < 40; i += 1) store().moveFlower(id, i / 40, 0.5);
    expect(store().past).toHaveLength(before + 1);
  });

  it('bounds the history depth', () => {
    for (let i = 0; i < LIMITS.historyDepth + 25; i += 1) {
      store().setVase({ height: 1 + (i % 20) * 0.01 });
    }
    expect(store().past.length).toBeLessThanOrEqual(LIMITS.historyDepth);
  });
});

describe('flower edits', () => {
  it('clamps a dragged position', () => {
    const id = store().addFlower(rose)!;
    store().moveFlower(id, -5, 5);
    const f = store().doc.flowers[0]!;
    expect(f.u).toBe(0);
    expect(f.depth).toBe(DEPTH_BOUNDS.max);
  });

  it('brings forward and sends back relative to the rest', () => {
    const a = store().addFlower(rose, 0.3, 0.5)!;
    const b = store().addFlower(rose, 0.6, 0.5)!;
    store().bringToFront(a);
    const zA = store().doc.flowers.find((f) => f.id === a)!.z!;
    expect(zA).toBeGreaterThan(store().doc.flowers.find((f) => f.id === b)!.depth);

    store().sendToBack(b);
    expect(store().doc.flowers.find((f) => f.id === b)!.z!).toBeLessThan(zA);
  });

  it('reseeds without changing anything else', () => {
    const id = store().addFlower(rose)!;
    const before = store().doc.flowers[0]!;
    store().reseed(id);
    const after = store().doc.flowers[0]!;
    expect(after.seed).not.toBe(before.seed);
    expect({ ...after, seed: 0 }).toEqual({ ...before, seed: 0 });
  });
});

describe('vase edits', () => {
  it('adopts a shape’s own defaults when switching', () => {
    const target = allVaseTypes().find((v) => v.id !== store().doc.vase.shapeId)!;
    store().setVase({ color: '#ff0000', pattern: 'terrazzo' });
    store().setVaseShape(target.id);

    const vase = store().doc.vase;
    expect(vase.shapeId).toBe(target.id);
    expect(vase.color).toBe(target.defaults.color);
    expect(vase.pattern).toBe(target.defaults.pattern);
    expect(vase.material).toBe(target.defaults.material);
  });

  it('falls back to a real shape for an unknown id', () => {
    store().setVaseShape('no-such-vase');
    expect(store().doc.vase.shapeId).toBe(getVaseTypeOrFirst('no-such-vase').id);
  });

  it('keeps the flowers when the vase changes, because position is rim-relative', () => {
    const id = store().addFlower(rose, 0.42, 0.6)!;
    store().setVaseShape(allVaseTypes()[3]!.id);
    store().setVase({ height: 1.3, width: 0.8 });
    const f = store().doc.flowers.find((x) => x.id === id)!;
    expect(f.u).toBeCloseTo(0.42, 6);
    expect(f.depth).toBeCloseTo(0.6, 6);
  });
});

describe('document-level actions', () => {
  it('changes the theme without touching history', () => {
    store().setTheme('dark');
    expect(store().doc.theme).toBe('dark');
    expect(store().past).toHaveLength(0);
  });

  it.each(PRESETS.map((p) => [p.id, p.name] as const))(
    'loads the %s preset with flowers and keeps the current theme',
    (id) => {
      store().setTheme('dark');
      store().applyPreset(id);
      expect(store().doc.flowers.length).toBeGreaterThan(0);
      expect(store().doc.theme).toBe('dark');
      expect(store().canUndo()).toBe(true);
    },
  );

  it('ignores an unknown preset', () => {
    store().applyPreset('no-such-preset');
    expect(store().doc.flowers).toHaveLength(0);
  });

  it('randomises into a valid, in-range arrangement', () => {
    for (let i = 0; i < 25; i += 1) {
      store().randomize();
      const doc = store().doc;
      expect(doc.flowers.length).toBeGreaterThan(0);
      expect(doc.flowers.length).toBeLessThanOrEqual(LIMITS.hardCap);
      expect(allVaseTypes().map((v) => v.id)).toContain(doc.vase.shapeId);
      for (const f of doc.flowers) {
        expect(allFlowerTypes().map((t) => t.id)).toContain(f.typeId);
        expect(f.u).toBeGreaterThanOrEqual(0);
        expect(f.u).toBeLessThanOrEqual(1);
        expect(f.depth).toBeGreaterThanOrEqual(DEPTH_BOUNDS.min);
        expect(f.depth).toBeLessThanOrEqual(DEPTH_BOUNDS.max);
      }
    }
  });

  it('clears selection and history when loading with resetHistory', () => {
    store().addFlower(rose);
    store().loadDoc(emptyDoc(), { resetHistory: true });
    expect(store().past).toHaveLength(0);
    expect(store().future).toHaveLength(0);
    expect(store().selectedId).toBeNull();
  });

  it('makes an import undoable when history is not reset', () => {
    store().addFlower(rose);
    store().loadDoc(emptyDoc());
    expect(store().doc.flowers).toHaveLength(0);
    store().undo();
    expect(store().doc.flowers).toHaveLength(1);
  });
});

describe('notices', () => {
  it('warns once when the soft cap is passed', () => {
    for (let i = 0; i < LIMITS.softCap; i += 1) store().addFlower(rose);
    store().dismissNotice();
    store().addFlower(rose);
    expect(store().notice?.text).toMatch(/full/i);
  });

  it('can be dismissed', () => {
    store().notify('hello');
    expect(store().notice).not.toBeNull();
    store().dismissNotice();
    expect(store().notice).toBeNull();
  });
});
