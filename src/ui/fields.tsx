/**
 * Reusable panel controls.
 *
 * `SliderField` and `ColorField` both accept a `coalesceKey`, which they pass
 * through to the store so that a slider sweep or a rapid colour drag collapses
 * into a single undo step.
 */
import { useId, type FC, type ReactNode } from 'react';
import { normalizeHex } from '../lib/color';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Renders the numeric readout; defaults to a percentage. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export const SliderField: FC<SliderFieldProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  format,
  onChange,
}) => {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        <span>{label}</span>
        <span className="field-value">{format ? format(value) : `${Math.round(value * 100)}%`}</span>
      </label>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
};

interface ColorFieldProps {
  label: string;
  value: string;
  swatches: string[];
  onChange: (value: string) => void;
}

export const ColorField: FC<ColorFieldProps> = ({ label, value, swatches, onChange }) => {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        <span>{label}</span>
        <span className="field-value mono">{value.toUpperCase()}</span>
      </label>
      <div className="color-row">
        <input
          id={id}
          className="color-input"
          type="color"
          value={value}
          onChange={(e) => onChange(normalizeHex(e.target.value, value))}
          aria-label={`${label} custom colour`}
        />
        <div className="swatches" role="group" aria-label={`${label} presets`}>
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`swatch${swatch.toLowerCase() === value.toLowerCase() ? ' is-active' : ''}`}
              style={{ background: swatch }}
              title={swatch}
              aria-label={swatch}
              onClick={() => onChange(swatch)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface SegmentedFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
}

export function SegmentedField<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: SegmentedFieldProps<T>) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
      </div>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`segment${option === value ? ' is-active' : ''}`}
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {labels?.[option] ?? option}
          </button>
        ))}
      </div>
    </div>
  );
}

export const PanelSection: FC<{ title: string; children: ReactNode; hint?: string }> = ({
  title,
  children,
  hint,
}) => (
  <section className="panel-section">
    <h3 className="panel-heading">{title}</h3>
    {hint && <p className="panel-hint">{hint}</p>}
    {children}
  </section>
);
