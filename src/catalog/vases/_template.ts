/**
 * TEMPLATE — copy this file to add a new vase shape.
 *
 * 1. Copy to `catalog/vases/my-vase.ts`
 * 2. Give it a unique `id`
 * 3. Write the `profile` function — that is genuinely all the geometry you owe
 * 4. Add `import './my-vase';` to `catalog/vases/index.ts`
 *
 * `profile(t)` is the vase's silhouette: given `t` from 0 (base) to 1 (rim), it
 * returns the half-width at that height as a multiple of the vase's nominal
 * half-width. 1.0 means "nominal width", 0.3 means "30% of that". You may go a
 * little above 1 for a bulging belly — up to `PROFILE_MAX` in
 * `render/vaseGeometry.ts`, which `tests/registry.test.ts` enforces.
 *
 * The renderer derives everything else from this one function: the body outline,
 * the rim ellipse, the interior cavity, the water line for glass materials, and
 * the anchor points that flower stems are seated on. So a new vase automatically
 * supports every material, every pattern, and correct flower placement without
 * you writing another line.
 */
import { registerVase } from '../registry';

export default registerVase({
  id: 'template-vase',
  name: 'Template',

  // A gentle barrel: narrow at the base, widest at mid-height, tapering to the rim.
  profile: (t) => 0.62 + Math.sin(t * Math.PI) * 0.38,

  // Soft guidance only — shown in the UI, never enforced.
  capacityHint: 9,

  defaults: {
    color: '#cdd6cc',
    accent: '#8fa38c',
    material: 'matte',
    pattern: 'none',
  },
});
