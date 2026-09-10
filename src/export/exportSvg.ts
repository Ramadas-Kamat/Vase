/**
 * Serialises the live scene to a standalone SVG file.
 *
 * Two things have to happen or the exported file renders wrong:
 *
 *  1. UI-only nodes (selection rings, drag handles, hints, hit targets) are
 *     stripped. They are all tagged `data-export="skip"` at the point of use.
 *  2. `var(--x)` references are resolved to literal colours. The artwork uses a
 *     handful of CSS custom properties for theme-aware ground and shadow tones;
 *     a standalone file has no stylesheet, so unresolved vars would render as
 *     black or nothing.
 *
 * The current sway rotation is baked in, because the loop writes real transform
 * attributes — so the export captures the arrangement exactly as it looks.
 */
import { SCENE } from '../render/vaseGeometry';

const VAR_PATTERN = /var\(\s*(--[\w-]+)\s*\)/g;

function resolveVars(value: string, computed: CSSStyleDeclaration): string {
  return value.replace(VAR_PATTERN, (_match, name: string) => {
    const resolved = computed.getPropertyValue(name).trim();
    return resolved || 'none';
  });
}

export function serializeScene(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const computed = getComputedStyle(document.documentElement);

  clone.querySelectorAll('[data-export="skip"]').forEach((node) => node.remove());

  // Resolve custom properties in every attribute of every remaining element.
  clone.querySelectorAll('*').forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      if (attr.value.includes('var(')) {
        node.setAttribute(attr.name, resolveVars(attr.value, computed));
      }
    }
  });

  const background = computed.getPropertyValue('--canvas').trim() || '#ffffff';
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(SCENE.w));
  bg.setAttribute('height', String(SCENE.h));
  bg.setAttribute('fill', background);
  clone.insertBefore(bg, clone.firstChild);

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(SCENE.w));
  clone.setAttribute('height', String(SCENE.h));
  clone.removeAttribute('class');
  clone.removeAttribute('role');
  clone.removeAttribute('aria-label');

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

export function svgBlob(svg: SVGSVGElement): Blob {
  return new Blob([serializeScene(svg)], { type: 'image/svg+xml;charset=utf-8' });
}
