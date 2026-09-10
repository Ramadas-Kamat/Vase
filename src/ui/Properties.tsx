/**
 * Contextual properties panel: the selected flower, or the vase when nothing is
 * selected.
 *
 * The flower half is CAPABILITY-DRIVEN. It asks the flower type which properties
 * it supports and renders only those controls — so eucalyptus, which declares no
 * `accentColor`, simply has no accent picker. A new flower type therefore gets a
 * complete, correct editor without this file changing.
 *
 * (Adding a brand-new *kind* of control — a new `Capability` — does mean editing
 * this file. That is intentional: a new capability is new UI, whereas a new
 * flower is just data.)
 */
import type { FC } from 'react';
import {
  MATERIALS,
  PATTERNS,
  TEXT_FONTS,
  TEXT_PLACEMENTS,
  type Capability,
  type Material,
  type Pattern,
  type TextFont,
  type TextPlacement,
} from '../types';
import { allVaseTypes, getFlowerType, getVaseTypeOrFirst } from '../catalog/registry';
import { useVase } from '../store/store';
import { LIMITS } from '../lib/normalize';
import { DEPTH_BOUNDS } from '../render/vaseGeometry';
import { ColorField, PanelSection, SegmentedField, SliderField } from './fields';
import { VaseThumb } from './VaseThumb';

/** Stems are always some green or woody brown; a full picker is still available. */
const STEM_SWATCHES = [
  '#4f7346',
  '#5b8a4a',
  '#6b8f4e',
  '#83957c',
  '#9db79f',
  '#3f5c3a',
  '#7a5b4a',
  '#a08a5f',
];

const VASE_SWATCHES = [
  '#d9dcd6',
  '#c98d6b',
  '#a8bcc9',
  '#e2d3b8',
  '#3f4a52',
  '#c7b7d4',
  '#bcd4d2',
  '#8c9a86',
  '#f0eae0',
  '#5c6b73',
];

const MATERIAL_LABELS: Record<Material, string> = {
  matte: 'Matte',
  gloss: 'Gloss',
  glass: 'Glass',
  gradient: 'Fade',
};

const PATTERN_LABELS: Record<Pattern, string> = {
  none: 'Plain',
  stripes: 'Stripes',
  dots: 'Dots',
  terrazzo: 'Terrazzo',
};

const PLACEMENT_LABELS: Record<TextPlacement, string> = {
  vase: 'On vase',
  tag: 'Gift tag',
  note: 'Note card',
  caption: 'Caption',
};

const FONT_LABELS: Record<TextFont, string> = {
  serif: 'Serif',
  sans: 'Sans',
  script: 'Script',
  mono: 'Mono',
};

const TEXT_SWATCHES = [
  '#5c5346',
  '#2f2a24',
  '#8a5a2b',
  '#4f7346',
  '#8d2050',
  '#3f4a52',
  '#ffffff',
];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const deg = (v: number) => `${Math.round(v)}°`;

interface PropertiesProps {
  onRequestRemove: (id: string) => void;
}

export const Properties: FC<PropertiesProps> = ({ onRequestRemove }) => {
  const doc = useVase((s) => s.doc);
  const selectedId = useVase((s) => s.selectedId);
  const setVase = useVase((s) => s.setVase);
  const setVaseShape = useVase((s) => s.setVaseShape);
  const setText = useVase((s) => s.setText);
  const updateFlower = useVase((s) => s.updateFlower);
  const duplicateFlower = useVase((s) => s.duplicateFlower);
  const bringToFront = useVase((s) => s.bringToFront);
  const sendToBack = useVase((s) => s.sendToBack);
  const reseed = useVase((s) => s.reseed);

  const flower = doc.flowers.find((f) => f.id === selectedId) ?? null;
  const flowerType = flower ? getFlowerType(flower.typeId) : null;

  // ---------------------------------------------------------------- flower ---
  if (flower && flowerType) {
    const has = (capability: Capability) => flowerType.capabilities.includes(capability);
    const set = (patch: Parameters<typeof updateFlower>[1], key?: string) =>
      updateFlower(flower.id, patch, key);

    return (
      <aside className="panel" aria-label={`${flowerType.name} settings`}>
        <header className="panel-header">
          <div>
            <p className="panel-eyebrow">Selected stem</p>
            <h2 className="panel-title">{flowerType.name}</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => useVase.getState().select(null)}
            title="Deselect (Esc)"
          >
            Done
          </button>
        </header>

        <PanelSection title="Colour">
          {has('petalColor') && (
            <ColorField
              label={flowerType.category === 'filler' ? 'Leaves' : 'Petals'}
              value={flower.colors.petal}
              swatches={flowerType.palette}
              onChange={(petal) =>
                set({ colors: { ...flower.colors, petal } }, `petal:${flower.id}`)
              }
            />
          )}
          {has('accentColor') && (
            <ColorField
              label="Centre"
              value={flower.colors.accent}
              swatches={['#f4c96b', '#8a5a2b', '#ffe3b0', '#e0a03f', '#b7a6de', '#ffffff']}
              onChange={(accent) =>
                set({ colors: { ...flower.colors, accent } }, `accent:${flower.id}`)
              }
            />
          )}
          {has('stemColor') && (
            <ColorField
              label="Stem"
              value={flower.colors.stem}
              swatches={STEM_SWATCHES}
              onChange={(stem) => set({ colors: { ...flower.colors, stem } }, `stem:${flower.id}`)}
            />
          )}
        </PanelSection>

        <PanelSection title="Shape">
          {has('size') && (
            <SliderField
              label="Size"
              value={flower.size}
              min={LIMITS.size.min}
              max={LIMITS.size.max}
              format={pct}
              onChange={(size) => set({ size }, `size:${flower.id}`)}
            />
          )}
          {has('stemLength') && (
            <SliderField
              label="Stem length"
              value={flower.stemLength}
              min={LIMITS.stemLength.min}
              max={LIMITS.stemLength.max}
              format={pct}
              onChange={(stemLength) => set({ stemLength }, `len:${flower.id}`)}
            />
          )}
          {has('lean') && (
            <SliderField
              label="Lean"
              value={flower.lean}
              min={LIMITS.lean.min}
              max={LIMITS.lean.max}
              step={0.5}
              format={deg}
              onChange={(lean) => set({ lean }, `lean:${flower.id}`)}
            />
          )}
        </PanelSection>

        <PanelSection title="Position" hint="Or just drag the stem in the vase.">
          <SliderField
            label="Across"
            value={flower.u}
            min={0}
            max={1}
            format={pct}
            onChange={(u) => set({ u }, `u:${flower.id}`)}
          />
          <SliderField
            label="Front / back"
            value={flower.depth}
            min={DEPTH_BOUNDS.min}
            max={DEPTH_BOUNDS.max}
            format={pct}
            onChange={(depth) => set({ depth }, `depth:${flower.id}`)}
          />
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => bringToFront(flower.id)}>
              Bring forward
            </button>
            <button type="button" className="btn" onClick={() => sendToBack(flower.id)}>
              Send back
            </button>
          </div>
          {flower.z !== null && (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => set({ z: null })}
            >
              Reset to automatic order
            </button>
          )}
        </PanelSection>

        <PanelSection title="Stem" hint="Every stem is procedurally varied from its seed.">
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => reseed(flower.id)}>
              Vary shape
            </button>
            <button type="button" className="btn" onClick={() => duplicateFlower(flower.id)}>
              Duplicate
            </button>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => onRequestRemove(flower.id)}
          >
            Remove stem
          </button>
        </PanelSection>
      </aside>
    );
  }

  // ------------------------------------------------------------------ vase ---
  const vase = doc.vase;
  const text = doc.text;
  const vaseType = getVaseTypeOrFirst(vase.shapeId);
  const showAccent = vase.pattern !== 'none' || vase.material === 'gradient';
  const overCapacity = doc.flowers.length > vaseType.capacityHint;

  return (
    <aside className="panel" aria-label="Vase settings">
      <header className="panel-header">
        <div>
          <p className="panel-eyebrow">Nothing selected</p>
          <h2 className="panel-title">The vase</h2>
        </div>
      </header>

      <PanelSection title="Shape">
        <div className="shape-grid">
          {allVaseTypes().map((type) => (
            <button
              key={type.id}
              type="button"
              className={`shape-item${type.id === vase.shapeId ? ' is-active' : ''}`}
              onClick={() => setVaseShape(type.id)}
              title={`${type.name} — suits about ${type.capacityHint} stems`}
            >
              <VaseThumb
                type={type}
                color={type.id === vase.shapeId ? vase.color : type.defaults.color}
              />
              <span className="shape-label">{type.name}</span>
            </button>
          ))}
        </div>
        <p className="panel-hint">
          {doc.flowers.length} of about {vaseType.capacityHint} stems
          {overCapacity ? ' — fuller than this shape really wants, but go on.' : '.'}
        </p>
      </PanelSection>

      <PanelSection title="Finish">
        <SegmentedField
          label="Material"
          value={vase.material}
          options={MATERIALS}
          labels={MATERIAL_LABELS}
          onChange={(material) => setVase({ material })}
        />
        <SegmentedField
          label="Pattern"
          value={vase.pattern}
          options={PATTERNS}
          labels={PATTERN_LABELS}
          onChange={(pattern) => setVase({ pattern })}
        />
        <ColorField
          label="Colour"
          value={vase.color}
          swatches={VASE_SWATCHES}
          onChange={(color) => setVase({ color }, 'vase-color')}
        />
        {showAccent && (
          <ColorField
            label={vase.material === 'gradient' ? 'Fade to' : 'Pattern colour'}
            value={vase.accent}
            swatches={VASE_SWATCHES}
            onChange={(accent) => setVase({ accent }, 'vase-accent')}
          />
        )}
      </PanelSection>

      <PanelSection title="Proportions" hint="Flowers re-seat themselves automatically.">
        <SliderField
          label="Height"
          value={vase.height}
          min={LIMITS.vaseHeight.min}
          max={LIMITS.vaseHeight.max}
          format={pct}
          onChange={(height) => setVase({ height }, 'vase-height')}
        />
        <SliderField
          label="Width"
          value={vase.width}
          min={LIMITS.vaseWidth.min}
          max={LIMITS.vaseWidth.max}
          format={pct}
          onChange={(width) => setVase({ width }, 'vase-width')}
        />
      </PanelSection>

      <PanelSection title="Note" hint="Leave this empty for no note.">
        <div className="field">
          <label className="field-label" htmlFor="note-content">
            <span>Message</span>
            <span className="field-value mono">
              {text.content.length}/{LIMITS.textMaxLength}
            </span>
          </label>
          <textarea
            id="note-content"
            className="text-input"
            rows={2}
            maxLength={LIMITS.textMaxLength}
            placeholder="Happy birthday…"
            value={text.content}
            onChange={(e) => setText({ content: e.target.value }, 'note-content')}
          />
        </div>

        {text.content.trim().length > 0 && (
          <>
            <SegmentedField
              label="Placement"
              value={text.placement}
              options={TEXT_PLACEMENTS}
              labels={PLACEMENT_LABELS}
              onChange={(placement) => setText({ placement })}
            />
            <SegmentedField
              label="Font"
              value={text.font}
              options={TEXT_FONTS}
              labels={FONT_LABELS}
              onChange={(font) => setText({ font })}
            />
            <ColorField
              label="Colour"
              value={text.color}
              swatches={TEXT_SWATCHES}
              onChange={(color) => setText({ color }, 'note-color')}
            />
            <SliderField
              label="Size"
              value={text.size}
              min={LIMITS.textSize.min}
              max={LIMITS.textSize.max}
              format={pct}
              onChange={(size) => setText({ size }, 'note-size')}
            />
          </>
        )}
      </PanelSection>

      <p className="panel-hint panel-hint-foot">
        Click a stem to edit it. Right-click for order and duplicate.
      </p>
    </aside>
  );
};
