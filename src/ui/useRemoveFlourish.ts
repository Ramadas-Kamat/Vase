/**
 * Removal with an exit animation.
 *
 * A React unmount is instantaneous, so the flower has to stay mounted while its
 * exit animation plays. This hook holds the id in an `exiting` set, spawns a
 * petal burst at the bloom's position, and only then dispatches the real store
 * removal — which keeps removal a single, undoable action.
 *
 * With motion disabled the removal is immediate, no burst, no delay.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Doc } from '../types';
import type { VaseGeometry } from '../render/vaseGeometry';
import type { Burst } from '../render/Petals';
import { getFlowerType } from '../catalog/registry';
import { useVase } from '../store/store';
import { newSeed } from '../lib/rng';

const EXIT_MS = 280;
const BURST_MS = 1500;

export function useRemoveFlourish(doc: Doc, geo: VaseGeometry, motion: boolean) {
  const removeFlower = useVase((s) => s.removeFlower);
  const [exiting, setExiting] = useState<Set<string>>(() => new Set());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const burstSeq = useRef(0);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const requestRemove = useCallback(
    (id: string) => {
      const flower = doc.flowers.find((f) => f.id === id);
      if (!flower) return;

      if (!motion) {
        removeFlower(id);
        return;
      }
      // Already on its way out — ignore repeat requests (double-tap, key repeat).
      if (exiting.has(id)) return;

      const type = getFlowerType(flower.typeId);
      const anchor = geo.anchorAt(flower.u, flower.depth);
      const length = (104 + (type?.headRadius ?? 24) * 0.5) * flower.stemLength;
      const lean = (flower.lean * Math.PI) / 180;

      burstSeq.current += 1;
      const burstId = burstSeq.current;
      // Approximate the bloom's position: the stem tip rotated by its lean.
      setBursts((current) => [
        ...current,
        {
          id: burstId,
          x: anchor.x + Math.sin(lean) * length * anchor.scale,
          y: anchor.y - Math.cos(lean) * length * anchor.scale,
          color: flower.colors.petal,
          seed: newSeed(),
        },
      ]);

      setExiting((current) => new Set(current).add(id));

      timers.current.push(
        setTimeout(() => {
          removeFlower(id);
          setExiting((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }, EXIT_MS),
        setTimeout(() => {
          setBursts((current) => current.filter((b) => b.id !== burstId));
        }, BURST_MS),
      );
    },
    [doc.flowers, motion, exiting, geo, removeFlower],
  );

  return { exiting, bursts, requestRemove };
}
