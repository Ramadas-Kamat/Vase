/**
 * The note. One of four placements, all derived from the live vase geometry so
 * they follow the vase as it is resized or reshaped.
 *
 * EXPORT CONSTRAINT — read before changing anything here.
 * `export/exportSvg.ts` resolves `var()` only inside ATTRIBUTES, and a
 * standalone SVG carries no stylesheet. So every visual property below is set
 * as a presentation attribute (`fill`, `font-family`, `font-size`), never via a
 * CSS class, or the note would render as default black serif in exported PNG
 * and SVG files. For the same reason the font stacks are system families only:
 * a webfont would not be embedded, and would additionally taint the export
 * canvas.
 */
import type { FC } from 'react';
import type { DocText, TextFont } from '../types';
import { SCENE, type VaseGeometry } from './vaseGeometry';

const FONT_STACKS: Record<TextFont, string> = {
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  script: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive",
  mono: "ui-monospace, Menlo, Consolas, monospace",
};

/** Base font size per placement, before the user's size multiplier. */
const BASE_SIZE: Record<DocText['placement'], number> = {
  vase: 30,
  tag: 20,
  note: 22,
  caption: 34,
};

const LINE_RATIO = 1.25;

/**
 * Rough advance width per character, as a fraction of font size. SVG cannot
 * measure text without a live DOM, and the exporter clones detached nodes, so
 * a measurement-free estimate keeps rendering and export identical.
 */
const GLYPH_RATIO: Record<TextFont, number> = {
  serif: 0.5,
  sans: 0.52,
  script: 0.42,
  mono: 0.6,
};

function lines(content: string): string[] {
  return content.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

function widestLine(ls: string[]): number {
  return ls.reduce((max, l) => Math.max(max, l.length), 0);
}

/**
 * Shrink to fit `maxWidth`, never grow. Long notes get smaller rather than
 * spilling outside the vase or off the canvas.
 */
function fittedSize(ls: string[], font: TextFont, desired: number, maxWidth: number): number {
  const estimated = widestLine(ls) * GLYPH_RATIO[font] * desired;
  return estimated <= maxWidth ? desired : Math.max(8, (maxWidth / estimated) * desired);
}

interface TextBlockProps {
  ls: string[];
  x: number;
  /** Vertical centre of the block. */
  cy: number;
  size: number;
  font: TextFont;
  color: string;
  opacity?: number;
  rotate?: number;
}

const TextBlock: FC<TextBlockProps> = ({ ls, x, cy, size, font, color, opacity, rotate }) => {
  const lineHeight = size * LINE_RATIO;
  const top = cy - ((ls.length - 1) * lineHeight) / 2;
  return (
    <text
      x={x}
      y={top}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily={FONT_STACKS[font]}
      fontSize={size}
      fill={color}
      opacity={opacity}
      transform={rotate ? `rotate(${rotate} ${x} ${cy})` : undefined}
      style={{ pointerEvents: 'none', whiteSpace: 'pre' }}
    >
      {ls.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

interface VaseTextProps {
  text: DocText;
  geo: VaseGeometry;
}

export const VaseText: FC<VaseTextProps> = ({ text, geo }) => {
  const ls = lines(text.content);
  if (ls.length === 0) return null;

  const { placement, font, color, size } = text;
  const desired = BASE_SIZE[placement] * size;

  if (placement === 'vase') {
    // Sit on the belly, where every profile is at or near its widest, and fit
    // to the actual half-width at that height so the note never overhangs.
    const cy = geo.rimY + geo.height * 0.52;
    const maxWidth = geo.halfWidthAtY(cy) * 2 * 0.78;
    return (
      <TextBlock
        ls={ls}
        x={geo.cx}
        cy={cy}
        size={fittedSize(ls, font, desired, maxWidth)}
        font={font}
        color={color}
        // Slightly translucent so it reads as printed on the surface rather
        // than floating in front of it.
        opacity={0.92}
      />
    );
  }

  if (placement === 'tag') {
    const fitted = fittedSize(ls, font, desired, 132);
    const cardW = Math.max(74, widestLine(ls) * GLYPH_RATIO[font] * fitted + 26);
    const cardH = ls.length * fitted * LINE_RATIO + 20;
    // Hang off the rim on the right, clear of the widest point of the body.
    const anchorX = geo.cx + geo.rimRx * 0.72;
    const anchorY = geo.rimY + geo.rimRy * 0.6;
    const cardCx = anchorX + cardW * 0.34;
    const cardCy = anchorY + 62;

    return (
      <g>
        <path
          d={`M ${anchorX} ${anchorY} Q ${anchorX + 10} ${anchorY + 26} ${cardCx} ${cardCy - cardH / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          opacity={0.55}
        />
        <g transform={`rotate(4 ${cardCx} ${cardCy})`}>
          <rect
            x={cardCx - cardW / 2}
            y={cardCy - cardH / 2}
            width={cardW}
            height={cardH}
            rx={6}
            fill="#fffdf7"
            stroke={color}
            strokeWidth={1.1}
            opacity={0.97}
          />
          <circle cx={cardCx} cy={cardCy - cardH / 2 + 8} r={2.6} fill="none" stroke={color} strokeWidth={1} />
          <TextBlock
            ls={ls}
            x={cardCx}
            cy={cardCy + 3}
            size={fitted}
            font={font}
            color={color}
          />
        </g>
      </g>
    );
  }

  if (placement === 'note') {
    const fitted = fittedSize(ls, font, desired, 190);
    const cardW = Math.max(120, widestLine(ls) * GLYPH_RATIO[font] * fitted + 34);
    const cardH = ls.length * fitted * LINE_RATIO + 30;
    // Propped against the front of the rim, as a card tucked into the bouquet.
    const cardCx = geo.cx - geo.rimRx * 0.1;
    const cardCy = geo.rimY - cardH * 0.15;

    return (
      <g transform={`rotate(-5 ${cardCx} ${cardCy})`}>
        <rect
          x={cardCx - cardW / 2}
          y={cardCy - cardH / 2}
          width={cardW}
          height={cardH}
          rx={4}
          fill="#fffdf7"
          stroke={color}
          strokeWidth={1.1}
          opacity={0.97}
        />
        {/* Fold line, to read as a folded card rather than a floating label. */}
        <line
          x1={cardCx - cardW / 2}
          y1={cardCy - cardH / 2 + 9}
          x2={cardCx + cardW / 2}
          y2={cardCy - cardH / 2 + 9}
          stroke={color}
          strokeWidth={0.7}
          opacity={0.35}
        />
        <TextBlock ls={ls} x={cardCx} cy={cardCy + 5} size={fitted} font={font} color={color} />
      </g>
    );
  }

  // caption
  return (
    <TextBlock
      ls={ls}
      x={SCENE.cx}
      cy={SCENE.groundY + 52}
      size={fittedSize(ls, font, desired, SCENE.w * 0.84)}
      font={font}
      color={color}
    />
  );
};
