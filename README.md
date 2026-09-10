# Digital Flower Vase

An interactive digital flower vase. Customise the vase, then arrange the flowers.

Everything is drawn as SVG in the browser — pick a silhouette, finish and colour
for the vase, drag stems in from the tray, and nudge each one until the
arrangement looks right. Then export it as a PNG, an SVG, a JSON file, or a link.

## Features

- **8 flowers** — rose, tulip, daisy, sunflower, lavender, blossom, eucalyptus
  and baby's breath, split into blooms and foliage.
- **8 vase shapes** — cylinder, amphora, bulb, cone, square, bud vase, fishbowl
  and tall, each resizable in height and width.
- **4 materials and 4 patterns** — matte, gloss, glass and fade; plain, stripes,
  dots and terrazzo.
- **Direct manipulation** — drag a flower from the tray to place it, drag a stem
  in the vase to move it, right-click for z-order and duplicate.
- **A customisable note** — write a message and place it on the vase, on a gift
  tag, on a note card tucked into the arrangement, or as a caption underneath.
  Four fonts, any colour, adjustable size.
- **Procedural variation** — every stem is generated from a seed, so two flowers
  with identical settings still look hand-picked. "Vary shape" re-rolls the seed.
- **Undo and redo** — 80 steps deep, with continuous drags collapsed into a
  single history entry.
- **4 starter arrangements** plus a "Surprise me" randomiser.
- **Light and dark themes**, and a gentle breeze animation that turns itself off
  when the system asks for reduced motion.
- **Export and share** — PNG, SVG, JSON, or a compressed share link.
- **Autosave** to `localStorage`, so a reload picks up where you left off.

## Quick start

Requires Node.js 20.19+ or 22.12+ (Vite 8).

```bash
npm install
npm run dev
```

Then open the URL Vite prints (by default <http://localhost:5173>).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload. |
| `npm run build` | Typecheck, then build to `dist/`. |
| `npm run preview` | Serve the built `dist/` locally. |
| `npm run typecheck` | `tsc --noEmit`, no build output. |
| `npm test` | Run the test suite once. |
| `npm run test:watch` | Run the tests in watch mode. |

## Project layout

```
src/
  types.ts          Shared domain types — start here
  App.tsx           Layout, keyboard shortcuts, tray→scene placement gesture
  presets.ts        The starter arrangements
  persistence.ts    localStorage autosave, JSON save/open
  catalog/
    registry.ts     Flower and vase registries
    flowers/        One file per flower, plus _template.tsx
    vases/          Vase silhouettes, plus _template.ts
  render/
    vaseGeometry.ts Derives every coordinate from the vase profile
    Scene.tsx       The SVG scene, selection and drag handling
    VaseArt.tsx     Vase body, materials and patterns
    Stem.tsx        Stems and leaves, drawn from each type's stem spec
    sway.ts         The shared breeze animation clock
  ui/               Toolbar, tray, properties panel, context menu, toasts
  lib/              Seeded RNG, colour, geometry, share codec, normalisation
  export/           PNG and SVG exporters
  styles/           Theme tokens, base layout, panel styling
tests/              Vitest suites for the logic layer
```

## Architecture

Four ideas carry most of the design.

**The document is the only source of truth.** `Doc` — the theme, the vase, and a
list of flowers — is the entire application state, and it is plain serialisable
data. Saving, sharing and undo are all just copies of it.

**Geometry is derived, never stored.** A flower records `u` (position across the
vase mouth, 0 to 1) and `depth` (front to back, 0 to 1), never pixels.
`render/vaseGeometry.ts` resolves those against the current vase at render time.
This is why swapping a cylinder for a fishbowl re-seats every flower correctly
for free, and why a share link stays valid no matter what the vase is doing.

**The catalog is a plugin registry.** A flower or vase type registers itself when
its module is imported. The tray, properties panel, randomiser, thumbnails and
share codec all read from the registry, so nothing else needs to know a new type
exists.

**The properties panel is generated.** A flower type declares its `capabilities`
— `petalColor`, `size`, `lean` and so on — and the panel builds the matching
controls. Eucalyptus has no flower centre, so it simply omits `accentColor` and
the Centre picker disappears for that type alone. No UI code branches on flower
type.

One consequence worth knowing: all procedural variation must come from a
flower's `seed` via `lib/rng.ts`, never `Math.random()` at render time. A seeded
flower redraws identically on reload and survives a round trip through a share
link.

A second, easy to trip over: **anything drawn into the scene must be styled with
SVG presentation attributes, not CSS classes.** `export/exportSvg.ts` resolves
`var()` only in attributes, and a standalone SVG file carries no stylesheet, so
class-based styling silently disappears from exported PNG and SVG files. For the
same reason, only system font stacks are used — a webfont would not be embedded
in the SVG, and would taint the PNG export canvas. See `render/VaseText.tsx`.

## Adding a flower

Copy [`src/catalog/flowers/_template.tsx`](src/catalog/flowers/_template.tsx) to
`src/catalog/flowers/my-flower.tsx`, give it a unique `id`, draw the bloom in
`Head`, then add one line to
[`src/catalog/flowers/index.ts`](src/catalog/flowers/index.ts):

```ts
import './my-flower';
```

That is the whole job. The tray button, properties controls, stem, leaves, sway,
placement, z-ordering, export and share support all come for free.

Drawing `Head`: the origin `(0, 0)` is where the stem meets the flower, and
negative y is up. Draw at roughly 20–40 units to sit in the same visual range as
the stock types; the size slider scales from there. You only draw the bloom —
`render/Stem.tsx` draws the stem from the `stem` spec you declare.

The order of imports in `index.ts` is the order flowers appear in the tray, with
blooms grouped ahead of fillers.

## Adding a vase

Copy [`src/catalog/vases/_template.ts`](src/catalog/vases/_template.ts) to
`src/catalog/vases/my-vase.ts`, then add one line to
[`src/catalog/vases/index.ts`](src/catalog/vases/index.ts).

The only geometry you owe is `profile(t)`: given `t` from 0 at the base to 1 at
the rim, return the half-width there as a multiple of the vase's nominal
half-width. A little over 1 is allowed for a bulging belly, up to `PROFILE_MAX`
in `render/vaseGeometry.ts` — `tests/registry.test.ts` enforces the ceiling.

```ts
// A gentle barrel: narrow at the base, widest at mid-height, tapering to the rim.
profile: (t) => 0.62 + Math.sin(t * Math.PI) * 0.38,
```

The renderer derives the body outline, rim ellipse, interior cavity, glass water
line and stem anchor points from that one function, so a new vase supports every
material and pattern without another line of code.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `⌘Z` / `Ctrl+Z` | Undo |
| `⇧⌘Z` / `Ctrl+Shift+Z` | Redo |
| `Escape` | Deselect |
| `Delete` / `Backspace` | Remove the selected stem |
| `←` `→` | Move the selected stem across the vase |
| `↑` `↓` | Move it front to back |
| Hold `Shift` | Finer nudges |

## Saving and sharing

- **Autosave** — the document is written to `localStorage` (`dfv:doc:v1`) 400 ms
  after you stop editing.
- **Boot order** — a share link in the URL hash wins, then `localStorage`, then
  the first starter arrangement.
- **Share link** — *Share & download → Copy link* compresses the document into
  the URL hash with `lz-string`. Links over 2000 characters are refused, since
  some clients truncate them; save a JSON file for very large arrangements
  instead. A note is appended to the payload and omitted entirely when empty, so
  links written before notes existed still open, and adding a note costs nothing
  unless you use one.
- **JSON** — *Download JSON file* and *Open JSON…* round-trip the document.
  Imports are normalised, so a file referring to a flower type that no longer
  exists loads what it can and reports what it dropped.
- **PNG and SVG** — exported from the live scene, note included.

Limits: 24 stems is a soft cap the UI warns about, 40 is a hard cap, both defined
in `lib/normalize.ts` to protect the 60fps target.

## Testing

```bash
npm test
```

Vitest covers the logic layer — the store and its history, the share codec, the
catalog registry's invariants, and vase geometry.

The React components, the PNG/SVG exporters and `persistence.ts` are not yet
covered. Vitest currently runs with `environment: 'node'` over
`tests/**/*.test.ts`, so adding component tests means switching to jsdom and
widening that glob to include `.tsx`.

The suite runs in CI on every push to `main`, and a failure blocks deployment —
see [Deployment](#deployment).

## Deployment

The app is deployed to GitHub Pages at
**<https://ramadas-kamat.github.io/Vase/>**.

Deployment is automatic: pushing to `main` triggers
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which installs
dependencies, typechecks, runs the tests, builds, and publishes `dist/`.

The typecheck and test steps are gates — a commit that fails either one stops
the workflow instead of being published, so the deploy doubles as CI. You can
also trigger a deploy by hand from the Actions tab (`workflow_dispatch`).

`dist/` is gitignored and never committed; the workflow builds it fresh each run.

To build locally:

```bash
npm run build
```

The result is a static bundle in `dist/` with no server-side requirements.
Because there is no router — share links live in `location.hash`, which never
reaches the server — no SPA rewrite rules are needed, and `vite.config.ts` sets
`base: './'`, so the same bundle works from any sub-path. That covers GitHub
Pages project sites, Netlify, Cloudflare Pages, or a plain file server, with no
further configuration.
