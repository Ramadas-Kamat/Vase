/**
 * Flower palette.
 *
 * Generated entirely from the registry — a flower added to
 * `catalog/flowers/index.ts` appears here with a live thumbnail and no edits to
 * this file.
 *
 * INTERACTION: pointerdown starts a placement gesture owned by `App`. App
 * decides on release whether it was a drag (place under the cursor) or a tap
 * (auto-place). There is deliberately no onClick here, because a mouse click
 * fires pointerdown *and* click and would otherwise add two flowers.
 */
import type { FC, PointerEvent as ReactPointerEvent } from 'react';
import { flowerTypesByCategory } from '../catalog/registry';
import { FlowerThumb } from './FlowerThumb';

interface TrayProps {
  onStartPlacing: (typeId: string, event: ReactPointerEvent) => void;
  onQuickAdd: (typeId: string) => void;
  activeTypeId: string | null;
}

export const Tray: FC<TrayProps> = ({ onStartPlacing, onQuickAdd, activeTypeId }) => {
  const { bloom, filler } = flowerTypesByCategory();

  const renderGroup = (title: string, types: typeof bloom) => (
    <section className="tray-group">
      <h3 className="panel-heading">{title}</h3>
      <div className="tray-grid">
        {types.map((type) => (
          <button
            key={type.id}
            type="button"
            className={`tray-item${activeTypeId === type.id ? ' is-dragging' : ''}`}
            title={`${type.name} — drag into the vase, or press Enter to add`}
            onPointerDown={(event) => onStartPlacing(type.id, event)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onQuickAdd(type.id);
              }
            }}
          >
            <FlowerThumb type={type} />
            <span className="tray-label">{type.name}</span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <aside className="tray" aria-label="Flower palette">
      {renderGroup('Flowers', bloom)}
      {filler.length > 0 && renderGroup('Foliage', filler)}
      <p className="tray-foot">Drag a stem into the vase, or drag one out to remove it.</p>
    </aside>
  );
};
