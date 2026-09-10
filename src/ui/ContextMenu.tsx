/**
 * Right-click menu for a stem. Positioned in viewport coordinates and clamped
 * so it never opens off-screen.
 */
import { useEffect, useRef, type FC } from 'react';
import { useVase } from '../store/store';
import { getFlowerType } from '../catalog/registry';

export interface ContextTarget {
  id: string;
  clientX: number;
  clientY: number;
}

interface ContextMenuProps {
  target: ContextTarget;
  onClose: () => void;
  onRequestRemove: (id: string) => void;
}

const MENU = { w: 188, h: 208 } as const;

export const ContextMenu: FC<ContextMenuProps> = ({ target, onClose, onRequestRemove }) => {
  const ref = useRef<HTMLDivElement>(null);
  const doc = useVase((s) => s.doc);
  const duplicateFlower = useVase((s) => s.duplicateFlower);
  const bringToFront = useVase((s) => s.bringToFront);
  const sendToBack = useVase((s) => s.sendToBack);
  const reseed = useVase((s) => s.reseed);

  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', dismiss);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const flower = doc.flowers.find((f) => f.id === target.id);
  if (!flower) return null;
  const type = getFlowerType(flower.typeId);

  const left = Math.min(target.clientX, window.innerWidth - MENU.w - 8);
  const top = Math.min(target.clientY, window.innerHeight - MENU.h - 8);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div ref={ref} className="context-menu" style={{ left, top }} role="menu">
      <p className="context-title">{type?.name ?? 'Stem'}</p>
      <button type="button" role="menuitem" onClick={run(() => bringToFront(flower.id))}>
        Bring to front
      </button>
      <button type="button" role="menuitem" onClick={run(() => sendToBack(flower.id))}>
        Send to back
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={run(() => reseed(flower.id))}>
        Vary shape
      </button>
      <button type="button" role="menuitem" onClick={run(() => duplicateFlower(flower.id))}>
        Duplicate
      </button>
      <hr />
      <button
        type="button"
        role="menuitem"
        className="is-danger"
        onClick={run(() => onRequestRemove(flower.id))}
      >
        Remove
      </button>
    </div>
  );
};
