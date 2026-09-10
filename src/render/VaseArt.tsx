/**
 * Vase artwork, split into three layers so flower stems can be sandwiched
 * between them:
 *
 *   VaseDefs      gradients, patterns, clip path, shadow filter
 *   VaseInterior  the back of the mouth      — drawn BEHIND the stems
 *   ...flowers...
 *   VaseBodyLayer body, water, pattern, lip  — drawn IN FRONT of the stems
 *
 * That sandwich is what makes glass work with no special-casing anywhere else:
 * the body is painted over the stems at low opacity, so a glass vase shows the
 * submerged stems tinted by the glass while an opaque vase simply hides them.
 * One code path, correct for every material.
 */
import type { FC } from 'react';
import type { Material, VaseState } from '../types';
import type { VaseGeometry } from './vaseGeometry';
import { SCENE } from './vaseGeometry';
import { shade, mix } from '../lib/color';
import { f2 } from '../lib/geom';

interface VaseProps {
  geo: VaseGeometry;
  vase: VaseState;
}

const GLASS_OPACITY = 0.34;

function bodyFill(material: Material): string {
  switch (material) {
    case 'gradient':
      return 'url(#vase-grad-v)';
    case 'glass':
      return 'url(#vase-grad-glass)';
    default:
      return 'url(#vase-grad-h)';
  }
}

export const VaseDefs: FC<VaseProps> = ({ geo, vase }) => {
  const { color, accent, material, pattern } = vase;
  const light = shade(color, material === 'gloss' ? 0.36 : 0.2);
  const dark = shade(color, material === 'gloss' ? -0.32 : -0.2);

  return (
    <defs>
      {/* Horizontal form shading: matte and gloss get their volume from this. */}
      <linearGradient id="vase-grad-h" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={dark} />
        <stop offset="26%" stopColor={color} />
        <stop offset="58%" stopColor={light} />
        <stop offset="100%" stopColor={shade(color, -0.16)} />
      </linearGradient>

      <linearGradient id="vase-grad-v" x1="0" y1="1" x2="0.25" y2="0">
        <stop offset="0%" stopColor={shade(accent, -0.1)} />
        <stop offset="100%" stopColor={shade(color, 0.14)} />
      </linearGradient>

      <linearGradient id="vase-grad-glass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={shade(color, -0.12)} />
        <stop offset="40%" stopColor={shade(color, 0.3)} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>

      <linearGradient id="water-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={mix(color, '#7fb6cf', 0.75)} stopOpacity={0.55} />
        <stop offset="100%" stopColor={mix(color, '#3d6f8c', 0.6)} stopOpacity={0.7} />
      </linearGradient>

      {/* Contact shadow on the table. */}
      <filter id="soft-shadow" x="-50%" y="-120%" width="200%" height="340%">
        <feGaussianBlur stdDeviation="11" />
      </filter>

      <radialGradient id="ground-fade" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="var(--ground)" stopOpacity="1" />
        <stop offset="100%" stopColor="var(--ground)" stopOpacity="0" />
      </radialGradient>

      <clipPath id="vase-clip">
        <path d={geo.bodyPath} />
      </clipPath>

      {pattern === 'stripes' && (
        <pattern id="vase-pattern" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="none" />
          <rect x="0" width="9" height="22" fill={accent} opacity="0.55" />
        </pattern>
      )}

      {pattern === 'dots' && (
        <pattern id="vase-pattern" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="3.6" fill={accent} opacity="0.6" />
          <circle cx="20" cy="20" r="3.6" fill={accent} opacity="0.6" />
        </pattern>
      )}

      {pattern === 'terrazzo' && (
        <pattern id="vase-pattern" width="54" height="54" patternUnits="userSpaceOnUse">
          <polygon points="8,6 18,9 15,19 5,15" fill={accent} opacity="0.62" />
          <polygon points="34,4 44,10 37,17" fill={shade(accent, 0.3)} opacity="0.6" />
          <polygon points="24,26 33,30 28,38 20,34" fill={shade(accent, -0.18)} opacity="0.55" />
          <polygon points="44,32 52,38 45,45 40,39" fill={accent} opacity="0.5" />
          <polygon points="6,36 14,34 16,44 7,46" fill={shade(accent, 0.18)} opacity="0.55" />
        </pattern>
      )}
    </defs>
  );
};

/** Table surface and the vase's contact shadow. */
export const Ground: FC<VaseProps> = ({ geo }) => (
  <g>
    <ellipse
      cx={SCENE.cx + 6}
      cy={geo.baseY + 7}
      rx={geo.baseRx * 1.85 + 24}
      ry={geo.baseRy * 1.5 + 7}
      fill="var(--shadow)"
      opacity="0.5"
      filter="url(#soft-shadow)"
    />
    <ellipse
      cx={SCENE.cx}
      cy={geo.baseY + 2}
      rx={geo.baseRx * 1.12}
      ry={geo.baseRy * 0.78}
      fill="var(--shadow)"
      opacity="0.35"
    />
    <ellipse cx={SCENE.cx} cy={geo.baseY} rx={330} ry={16} fill="url(#ground-fade)" opacity="0.7" />
  </g>
);

/** The back of the mouth. Stems are drawn on top of this so they emerge from it. */
export const VaseInterior: FC<VaseProps> = ({ geo, vase }) => {
  const isGlass = vase.material === 'glass';
  return (
    <g>
      <ellipse
        cx={geo.cx}
        cy={geo.rimY}
        rx={geo.rimRx}
        ry={geo.rimRy}
        fill={isGlass ? shade(vase.color, -0.1) : shade(vase.color, -0.5)}
        opacity={isGlass ? 0.45 : 1}
      />
      <ellipse
        cx={geo.cx}
        cy={geo.rimY}
        rx={geo.rimRx}
        ry={geo.rimRy}
        fill="none"
        stroke={shade(vase.color, isGlass ? 0.2 : -0.6)}
        strokeWidth={1.4}
        opacity={0.8}
      />
    </g>
  );
};

/**
 * Body, water and lip. Painted over the stems — see the module comment for why
 * that single ordering decision handles both glass and opaque vases.
 */
export const VaseBodyLayer: FC<VaseProps> = ({ geo, vase }) => {
  const { material, pattern, color } = vase;
  const isGlass = material === 'glass';
  const waterRx = geo.halfWidthAtY(geo.waterY);

  return (
    <g>
      {isGlass && (
        <g clipPath="url(#vase-clip)">
          <rect
            x={geo.cx - geo.width}
            y={geo.waterY}
            width={geo.width * 2}
            height={geo.height}
            fill="url(#water-grad)"
          />
          <ellipse
            cx={geo.cx}
            cy={geo.waterY}
            rx={waterRx}
            ry={Math.max(4, waterRx * 0.22)}
            fill={shade(color, 0.42)}
            opacity={0.5}
          />
        </g>
      )}

      <path
        d={geo.bodyPath}
        fill={bodyFill(material)}
        fillOpacity={isGlass ? GLASS_OPACITY : 1}
        stroke={shade(color, isGlass ? -0.1 : -0.34)}
        strokeWidth={isGlass ? 2 : 1.4}
        strokeOpacity={isGlass ? 0.75 : 1}
      />

      {pattern !== 'none' && (
        <path
          d={geo.bodyPath}
          fill="url(#vase-pattern)"
          clipPath="url(#vase-clip)"
          opacity={isGlass ? 0.3 : 0.9}
        />
      )}

      {/* Specular highlight. Gloss and glass get a hard stripe, matte a soft one. */}
      <g clipPath="url(#vase-clip)">
        <ellipse
          cx={geo.cx - geo.width * 0.24}
          cy={geo.rimY + geo.height * 0.34}
          rx={geo.width * 0.075}
          ry={geo.height * 0.26}
          fill={shade(color, 0.75)}
          opacity={material === 'gloss' ? 0.5 : material === 'glass' ? 0.45 : 0.14}
        />
        {isGlass && (
          <ellipse
            cx={geo.cx + geo.width * 0.3}
            cy={geo.rimY + geo.height * 0.5}
            rx={geo.width * 0.035}
            ry={geo.height * 0.2}
            fill={shade(color, 0.85)}
            opacity={0.35}
          />
        )}
      </g>

      {/* Front lip, catching the light. */}
      <path
        d={`M ${f2(geo.cx - geo.rimRx)} ${f2(geo.rimY)} A ${f2(geo.rimRx)} ${f2(geo.rimRy)} 0 0 0 ${f2(geo.cx + geo.rimRx)} ${f2(geo.rimY)}`}
        fill="none"
        stroke={shade(color, 0.4)}
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={isGlass ? 0.8 : 0.9}
      />
    </g>
  );
};
