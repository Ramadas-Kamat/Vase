/**
 * The catalog registry — the single extension point of the application.
 *
 * Flower and vase types register themselves here at module load. Everything
 * downstream (the tray, the properties panel, the vase picker, the share-link
 * codec, randomize) reads from the registry rather than from hardcoded lists.
 *
 * TO ADD A FLOWER: create `catalog/flowers/my-flower.tsx` (copy `_template.tsx`)
 * and add one import line to `catalog/flowers/index.ts`. Nothing else.
 *
 * TO ADD A VASE: create `catalog/vases/my-vase.ts` (copy `_template.ts`) and add
 * one import line to `catalog/vases/index.ts`. Nothing else.
 */
import type { FlowerType, VaseType } from '../types';

const flowers = new Map<string, FlowerType>();
const vases = new Map<string, VaseType>();

export function registerFlower(type: FlowerType): FlowerType {
  if (flowers.has(type.id)) {
    throw new Error(`Duplicate flower id registered: "${type.id}"`);
  }
  flowers.set(type.id, type);
  return type;
}

export function registerVase(type: VaseType): VaseType {
  if (vases.has(type.id)) {
    throw new Error(`Duplicate vase id registered: "${type.id}"`);
  }
  vases.set(type.id, type);
  return type;
}

export function allFlowerTypes(): FlowerType[] {
  return [...flowers.values()];
}

export function allVaseTypes(): VaseType[] {
  return [...vases.values()];
}

export function getFlowerType(id: string): FlowerType | undefined {
  return flowers.get(id);
}

export function getVaseType(id: string): VaseType | undefined {
  return vases.get(id);
}

/**
 * Vase lookup that never fails. A saved document or share link may reference a
 * shape that has since been renamed or removed; falling back keeps old links
 * openable instead of crashing the app.
 */
export function getVaseTypeOrFirst(id: string): VaseType {
  const found = vases.get(id);
  if (found) return found;
  const first = vases.values().next().value;
  if (!first) throw new Error('No vase types registered — check catalog/vases/index.ts');
  return first;
}

export function hasFlowerType(id: string): boolean {
  return flowers.has(id);
}

/** Stable ordering for the flower tray: blooms first, then fillers. */
export function flowerTypesByCategory(): {
  bloom: FlowerType[];
  filler: FlowerType[];
} {
  const list = allFlowerTypes();
  return {
    bloom: list.filter((t) => t.category === 'bloom'),
    filler: list.filter((t) => t.category === 'filler'),
  };
}
