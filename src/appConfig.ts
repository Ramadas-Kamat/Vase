/**
 * Branding, resolved once at build time.
 *
 * The values come from `VITE_APP_*` environment variables, which Vite inlines
 * into the bundle during `npm run build`. Defaults live in `.env`; a deployment
 * overrides them by setting the same variables in its build environment
 * (Cloudflare build variables, GitHub Actions repository variables, or an
 * inline `VITE_APP_NAME='...' npm run build`).
 *
 * The fallbacks below are a safety net for a missing or blank `.env` — they
 * keep the UI from rendering an empty title rather than acting as the primary
 * source of the defaults.
 */

const DEFAULT_APP_NAME = 'Digital Flower Vase';
const DEFAULT_APP_DESCRIPTION =
  'An interactive digital flower vase — customise the vase, arrange the flowers.';

/**
 * Turns a display name into a filename stem, so a renamed build saves
 * `roses-for-anita.png` instead of the stock `flower-vase.png`.
 */
export function slugify(name: string): string {
  const slug = name
    // Decompose accents so "Café" slugs to "cafe" rather than losing the "é".
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Drop apostrophes rather than letting them become separators, so
    // "Kswari's Vase" slugs to "kswaris-vase" instead of "kswari-s-vase".
    .replace(/['\u2018\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // A name written entirely in punctuation or a non-Latin script leaves nothing
  // behind, and an empty stem would download as a dotfile.
  return slug || 'flower-vase';
}

export const APP_NAME: string = import.meta.env.VITE_APP_NAME?.trim() || DEFAULT_APP_NAME;

export const APP_DESCRIPTION: string =
  import.meta.env.VITE_APP_DESCRIPTION?.trim() || DEFAULT_APP_DESCRIPTION;

/** Filename stem shared by the PNG, SVG, and JSON downloads. */
export const FILE_SLUG: string = slugify(APP_NAME);
