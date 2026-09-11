# Architecture

How the app is put together and why it holds up. For the rationale behind
individual choices, see [decisions.md](decisions.md). For day-to-day usage and
deployment instructions, see the [README](../README.md).

## The one-sentence version

`Doc` is the entire application state; everything visible is a pure function of
it, and everything durable is a copy of it.

## The document model

```ts
interface Doc {
  v: 1;
  theme: Theme;
  vase: VaseState;
  flowers: Flower[];
  text: DocText;
}
```

`Doc` is plain, serialisable data — no class instances, no functions, no DOM
references. That single property is what makes four separate features fall out
almost for free:

| Feature | Implementation |
| --- | --- |
| Undo / redo | Keep old copies of `Doc` |
| Autosave | `JSON.stringify` into `localStorage` |
| Save / open a file | The same JSON, downloaded |
| Share link | The same JSON, packed and compressed into the URL hash |

None of these needed bespoke machinery. They are all consequences of the state
being a value rather than an object graph.

### Geometry is derived, never stored

A flower records where it sits in *rim space*, not pixel space:

- `u` — position across the vase mouth, `0` = left rim, `1` = right rim
- `depth` — front-to-back position, `0` = back, `1` = front

`render/vaseGeometry.ts` resolves those against the current vase at render time,
deriving the body outline, rim and base ellipses, interior cavity, water line,
and every stem anchor from one function: the vase's `profile(t)`.

The consequence is the important part. Swapping a cylinder for a fishbowl, or
dragging the height slider, re-seats every flower correctly *and for free* —
there is no migration step, because no pixel coordinate was ever committed to.
It is also why a share link stays valid no matter what the vase is doing.

This is the rule most likely to be broken by accident. **Never store absolute
coordinates in `Doc`.**

## Layers

```
main.tsx            boot: populate registry → resolve doc → mount
  └ App.tsx         layout, keyboard shortcuts, tray→scene placement
      ├ ui/         toolbar, tray, properties panel, context menu, toasts
      ├ render/     the SVG scene
      └ store/      zustand store: doc + history + selection

  catalog/          self-registering flower and vase types
  lib/              rng, colour, geometry, share codec, normalisation
  export/           PNG and SVG serialisers
```

Dependencies mostly point inward: `ui/` and `render/` read from `store/` and
`catalog/`, never the reverse.

`lib/` is the exception worth knowing. `geom`, `color`, `rng` and `share` depend
on nothing but types — but `lib/normalize.ts` reaches back out to
`catalog/registry` (to know which flower types still exist) and to
`render/vaseGeometry` (for the depth bounds it clamps to). That is inherent to
its job: repairing a document requires knowing what is currently valid, which
only those modules can answer. It is a deliberate exception, not an oversight,
and it is the reason `normalize` cannot be moved below the catalog in the import
order.

### Boot order matters

`main.tsx` imports `./catalog` first, before the store module is evaluated. The
store's initial state builds a preset, and a preset references flower types by
id — so the registry must already be populated or the app boots empty. This is
a real ordering constraint, not incidental import hygiene.

Then the starting document is resolved in priority order — **share link >
`localStorage` > first preset** — *before* the first render, so the user never
sees a flash of the default arrangement being swapped out.

A share link wins over stored work deliberately: the user followed that link on
purpose, and silently overriding it with their own saved vase would make shared
links look broken.

## The catalog registry

The single extension point. A flower or vase type registers itself when its
module is imported:

```ts
export const rose = registerFlower({ id: 'rose', /* … */ });
```

Adding a flower is one new file plus one import line in
`catalog/flowers/index.ts`. Nothing else in the codebase needs to learn that it
exists — the tray, properties panel, thumbnails, randomiser and share codec all
read from the registry rather than from hardcoded lists.

### The properties panel is generated

A flower type declares its `capabilities` (`petalColor`, `size`, `lean`, …) and
the panel builds the matching controls. Eucalyptus omits `accentColor`, so the
Centre picker disappears for eucalyptus alone — with no UI code branching on
flower type.

This is what stops the panel from accumulating `if (typeId === 'rose')` special
cases as the catalog grows.

### Lookups never crash

Documents outlive the catalog. A share link from last month may reference a
flower type since renamed or removed, so:

- Unknown **flower** types are dropped, and the user is told how many.
- Unknown **vase** types fall back to the first registered vase
  (`getVaseTypeOrFirst`).

All of this happens in `lib/normalize.ts`, which every document entering from
outside — `localStorage`, share link, imported file, even the shipped presets —
must pass through. It is the trust boundary: after `normalizeDoc`, the rest of
the app may assume the document is well-formed.

## Rendering

The scene is one fixed `720 × 720` SVG user-unit canvas, so exports are
deterministic regardless of viewport size.

Layer order (back to front), from `render/Scene.tsx`:

```
background hit rect → ground + shadow → vase interior
  → flowers (z-sorted) → vase body / water / lip → petal bursts
```

The vase is deliberately drawn in two pieces — interior behind the flowers, body
in front — so stems appear to sit *inside* the mouth rather than on top of it.

### Animation runs outside React

`render/sway.ts` keeps a single `requestAnimationFrame` loop that writes one
`transform` attribute per stem per frame. React never re-renders for animation.

The cost of the breeze is therefore independent of component-tree size, which is
what holds 60fps at the 40-flower cap. It also means the exporter captures the
arrangement exactly as it looks mid-sway, because the rotation is a real
attribute on a real node rather than React state.

### Procedural variation must be seeded

Every stem is generated from its `seed` via `lib/rng.ts`. **Never call
`Math.random()` at render time.** A seeded flower redraws identically on reload,
survives a round trip through a share link, and exports to match what is on
screen. An unseeded one silently breaks all three.

## Export

```
live SVG DOM → serializeScene() → standalone SVG markup
                                     ├→ .svg download
                                     └→ blob URL → <img> → <canvas> → .png
```

`serializeScene` does two things that are not optional:

1. **Strips UI-only nodes.** Selection rings, drag handles, hit targets and
   hints are tagged `data-export="skip"` at the point of use.
2. **Resolves `var(--x)` to literal colours.** A standalone SVG file carries no
   stylesheet, so unresolved custom properties would render as black or vanish.

### The export constraint

This is the subtlest rule in the codebase and the easiest to violate:

> Anything drawn into the scene must be styled with **SVG presentation
> attributes**, not CSS classes.

`exportSvg.ts` resolves `var()` only in *attributes*. Class-based styling has
nothing to resolve against once the markup leaves the page, so it silently
disappears from exported files — the app looks right, the export looks wrong,
and nothing errors.

For the same reason the scene uses **only system font stacks**. A webfont would
not be embedded in the SVG, and would taint the PNG export canvas, causing
`toBlob` to throw on a cross-origin check.

`render/VaseText.tsx` is the worked example of both rules.

PNG export goes through a blob URL rather than a data URL: a 40-flower scene
serialises to tens of kilobytes, and data URLs at that size are slow and
historically size-capped in some browsers.

## Share links

A raw JSON document is ~90 bytes per flower, which base64s past the ~2000
character URL ceiling well before the 40-flower cap. Two steps fix that:

1. **Transpose to positional arrays** with quantised numbers and `#` stripped
   from colours — roughly 3× smaller before compression.
2. **Compress** with lz-string's URI-safe LZW, which exploits the heavy
   repetition between flowers (same type ids, same palette) very effectively.

A 40-flower arrangement lands around 700–900 characters.

### Evolving the format

`text` was added as an *optional trailing element* of the packed tuple, omitted
entirely when there is no note. No version bump was needed:

- Links written before notes existed decode with `text` undefined and pick up
  defaults from `normalizeText`.
- An older client reading a newer link ignores the extra element.

Prefer this append-and-omit shape over bumping `CODEC_VERSION`. Bump only if the
*existing* positional layout has to change.

## State and history

`store/store.ts` is a zustand store holding `doc`, `selectedId`, and `past` /
`future` stacks.

History snapshots whole documents rather than diffing. At 40 flowers a document
is a few KB, so 80 levels of undo costs a few hundred KB — far cheaper than the
complexity of a diff/patch system.

**Coalescing:** continuous edits (dragging a stem, sweeping a slider) pass a
`coalesceKey`. Repeats of the same key within 650 ms mutate the present instead
of pushing a new entry, so one drag is one undo step rather than two hundred.

## Limits

From `lib/normalize.ts`:

| Limit | Value | Nature |
| --- | --- | --- |
| `softCap` | 24 stems | UI warns, still works |
| `hardCap` | 40 stems | Refused — protects the 60fps target |
| `historyDepth` | 80 | Undo levels |
| `textMaxLength` | 80 chars | Keeps notes inside the share budget and the artwork |
| `PROFILE_MAX` | 1.15 | Ceiling on a vase profile, enforced by tests |

`PROFILE_MAX` is enforced in `tests/registry.test.ts` rather than at runtime: a
profile is an arbitrary function, so there is nothing to validate short of
sampling every shape on every render. Some invariants belong in tests.

## Build and deployment topology

One branch builds to two independently-named deployments:

```
dev ──CI──▶ main ──┬──▶ GitHub Actions ──▶ GitHub Pages
                   └──▶ Workers Builds  ──▶ Cloudflare Workers
```

The bundle is host-agnostic: `base: './'` gives relative asset paths, and there
is no router — share state lives in `location.hash`, which never reaches the
server — so no SPA rewrite rules are needed anywhere.

Branding is injected at build time from `VITE_APP_NAME` /
`VITE_APP_DESCRIPTION` (see `src/appConfig.ts`), which is why the same commit
can serve under different names on the two hosts.

## Testing

Tests cover the logic layer — share codec round trips, normalisation and repair,
store actions and history, vase geometry, registry invariants, and the branding
slug. Rendering is verified by hand and in the browser rather than by snapshot,
since SVG snapshots are noisy and tend to assert on coordinates that are
*supposed* to be free to change.

One trap worth knowing: tests that assert on **share-link length** must pin
flower seeds. Seeds are the least-compressible part of the payload, so random
seeds make the compressed length vary run to run — which produced a genuine
intermittent CI failure before the fixtures were made deterministic.
