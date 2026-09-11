# Decisions

A log of choices that were not obvious, and what they cost. Each entry records
the alternative that was rejected, because that is usually the part worth
remembering.

Structural context lives in [architecture.md](architecture.md).

---

## 1. `Doc` is plain serialisable data

**Decision.** The entire application state is one plain object — no class
instances, no functions, no DOM references.

**Rejected.** An object graph with `Flower` instances holding methods and
back-references to their vase.

**Why.** Undo, autosave, file export and share links are all "copy the state
somewhere". With a value, each is a few lines. With an object graph, each needs
bespoke serialisation and rehydration, and they drift apart over time.

**Cost.** Behaviour cannot live on the data, so it lives in modules that take a
document and return a new one. This is the right trade here, but it does mean
`lib/` is wider than it would otherwise be.

---

## 2. Store rim-space coordinates, derive pixel-space

**Decision.** A flower stores `u` (across the mouth) and `depth` (front to
back). Absolute positions are computed at render time from the vase's
`profile(t)`.

**Rejected.** Storing `x`/`y` directly, which is simpler to render.

**Why.** Pixel coordinates are only meaningful relative to the vase that was on
screen when they were written. Storing them means every vase change needs a
migration pass over every flower, and an old share link opened against a
resized vase puts stems in mid-air.

**Consequence.** Changing shape, height or width re-seats every flower
correctly with no migration code. This is load-bearing — see decision 3 for the
other half of why a new vase is one file.

**Cost.** An indirection between what is stored and what is drawn, and a hard
rule that is easy to violate: never put absolute coordinates in `Doc`.

---

## 3. The catalog is a self-registering plugin registry

**Decision.** Flower and vase types register themselves on module import.
Adding one is a new file plus a single import line.

**Rejected.** A central `switch` or a hardcoded array of types.

**Why.** A central list has to be edited in every consuming feature — tray,
properties panel, thumbnails, randomiser, share codec. That is five chances to
forget one, and the failure is silent.

**Cost.** Import order becomes load-bearing: the registry must be populated
before the store is created, because the store's initial state builds a preset
that references type ids. `main.tsx` and `store.ts` both import `./catalog`
first, with a comment explaining why.

---

## 4. The properties panel is generated from capabilities

**Decision.** A flower type declares `capabilities: ['petalColor', 'size', …]`
and the panel renders the matching controls.

**Rejected.** Per-type panel components, or conditionals in one panel.

**Why.** Eucalyptus has no flower centre. Under the rejected approaches that
fact has to be expressed in UI code, and every new type risks another branch.
Declaring it on the type keeps the knowledge where the type is defined.

**Cost.** Controls are limited to the fixed `Capability` vocabulary. A type
needing a genuinely novel control requires extending that vocabulary rather
than just writing some JSX.

---

## 5. All procedural variation comes from a seed

**Decision.** Every stem derives its variation from `seed` via `lib/rng.ts`.
`Math.random()` is banned at render time.

**Why.** Three separate features quietly depend on redraw determinism: reload
via autosave, round trips through a share link, and export matching what is on
screen. `Math.random()` breaks all three, and breaks them *invisibly* — the app
looks fine, it just does not reproduce.

**Cost.** Seeds must be threaded through to anything that wants variation, and
they are the least compressible part of a share link (see decision 12).

---

## 6. History snapshots whole documents

**Decision.** Undo keeps copies of `Doc`. 80 levels deep.

**Rejected.** Diff/patch or command-object history.

**Why.** At the 40-flower cap a document is a few KB, so 80 levels is a few
hundred KB — cheap. A diff system would be meaningfully more code and a
meaningfully larger class of bugs, in exchange for memory that was never
scarce.

**Consequence.** Continuous edits needed a separate fix: dragging a stem would
otherwise push hundreds of entries. Hence `coalesceKey`, which merges repeats
of the same key within 650 ms into one history entry.

---

## 7. The animation loop lives outside React

**Decision.** `render/sway.ts` runs one `requestAnimationFrame` loop that writes
`transform` attributes directly on registered `<g>` nodes.

**Rejected.** Animating via React state or CSS animations.

**Why.** React state would re-render the tree up to 60 times a second, making
animation cost scale with component count — exactly backwards at the 40-flower
cap. CSS animations would not survive export, because the exported SVG has no
stylesheet (see decision 9).

**Consequence.** Because the rotation is a real attribute on a real node, the
exporter captures the scene mid-sway with no extra work.

---

## 8. The breeze is faked, not simulated

**Decision.** Two summed sine waves at incommensurate frequencies, offset per
stem by a seed-derived phase.

**Rejected.** A spring or pendulum simulation.

**Why.** A simulation carries per-stem velocity state that must live somewhere.
It does not belong in `Doc` (it is ephemeral, and would bloat every share link),
and keeping it outside `Doc` means the scene is no longer a pure function of its
state — so an export or a reload could not reproduce a given frame.

Summed sines are *stateless*: rotation is a pure function of `(time, phase,
amplitude)`. Any stem can be drawn at any instant with no history. Two
incommensurate frequencies keep the motion from reading as a metronome, which
was the only thing the simulation was really buying.

---

## 9. Scene styling uses SVG presentation attributes, never CSS classes

**Decision.** Everything drawn into the scene is styled with `fill`,
`font-family`, `font-size` and friends as attributes. System font stacks only.

**Why.** `export/exportSvg.ts` resolves `var()` references in *attributes*. A
standalone SVG file carries no stylesheet, so class-based styling has nothing to
resolve against and silently disappears from exported PNG and SVG files.

Webfonts fail twice over: they are not embedded in the exported SVG, and they
taint the PNG export canvas, making `toBlob` throw on a cross-origin check.

**Cost.** Scene code cannot share the stylesheet that the surrounding UI uses,
and the failure mode is silent — the app looks correct while exports are wrong.
This is the most violable rule in the codebase. `render/VaseText.tsx` is the
worked example.

---

## 10. Documents are repaired, never trusted

**Decision.** Every document from outside — `localStorage`, share link,
imported file, and the shipped presets — passes through `normalizeDoc`. Unknown
flower types are dropped with a count reported to the user; unknown vase types
fall back to the first registered vase.

**Rejected.** Validating and rejecting, or trusting stored data.

**Why.** Documents outlive the catalog. A link shared last month may name a
flower since renamed. Refusing to open it turns an old link into a dead one;
crashing is worse. Degrading — open the arrangement, drop the two stems that no
longer exist, say so — preserves the user's intent.

**Consequence.** After `normalizeDoc` the rest of the app may assume a
well-formed document, so validation is not scattered through the render path.
Running presets through the same path means a preset referencing a deleted
flower degrades instead of breaking the app.

---

## 11. A share link beats stored work at boot

**Decision.** Boot precedence is share link > `localStorage` > first preset.

**Why.** Following a link is a deliberate act. Overriding it with the user's own
saved vase would make every shared link appear broken to anyone who had used the
app before.

**Cost.** Opening a link discards nothing (the stored doc is untouched), but the
user is editing the shared arrangement rather than their own. A toast says so.

---

## 12. Share links are packed positionally, then compressed

**Decision.** Transpose the document to positional arrays with quantised numbers
and `#`-stripped colours, then compress with lz-string's URI-safe LZW.

**Rejected.** Base64'd JSON.

**Why.** Raw JSON is ~90 bytes per flower and passes the ~2000 character URL
ceiling well before the 40-flower cap. Packing gives ~3×, and LZW exploits the
heavy repetition between flowers effectively. A full arrangement lands around
700–900 characters.

**Cost.** The positional layout is order-sensitive and unreadable — a field
inserted in the middle silently corrupts every existing link. Hence decision 13.

---

## 13. The note field was appended, not versioned

**Decision.** `text` is an optional *trailing* element of the packed tuple,
omitted entirely when there is no note. `CODEC_VERSION` was not bumped.

**Rejected.** Bumping the version and writing a migration.

**Why.** Append-and-omit is compatible in both directions for free. Older links
decode with `text` undefined and pick up defaults; an older client reading a
newer link ignores the trailing element. A version bump would have required
keeping a decoder for v1 around indefinitely.

**Rule going forward.** Prefer appending optional trailing fields. Bump
`CODEC_VERSION` only when the *existing* positional layout must change.

---

## 14. `PROFILE_MAX` is enforced by a test, not at runtime

**Decision.** The ceiling on a vase profile is asserted in
`tests/registry.test.ts`.

**Why.** A profile is an arbitrary function `(t: number) => number`. There is
nothing to validate at registration time short of sampling it, and sampling
every shape on every render is pure waste to catch a mistake that can only be
made once, while writing a new vase.

**Generalisation.** Invariants over developer-authored content belong in tests.
Runtime validation is for user-authored content — which is what decision 10
covers.

---

## 15. Access control is an email allowlist, not a user counter

**Decision.** Cloudflare Access with an explicit email allowlist.

**Rejected.** Capping the number of distinct users or devices at N.

**Why.** A counter fails the actual requirement in both directions. It cannot
keep strangers out — if a forwarded link is opened by someone else first, they
consume a slot and the intended recipient is locked out. And it locks *out* the
legitimate user, whose phone, laptop and second browser all look like separate
users.

The allowlist inverts the secret: the URL stops being sensitive, because access
depends on controlling a mailbox. Forwarding the link to someone else
accomplishes nothing.

**Cost.** Recipients must complete an email one-time-PIN flow rather than just
clicking a link.

---

## 16. Deployed to Cloudflare Workers rather than Pages

**Decision.** Workers Static Assets, configured by `wrangler.jsonc`, with no
Worker script.

**Why.** Cloudflare steers new projects to Workers and has put Pages in
maintenance mode. On Workers an Access policy can attach to the Worker itself,
covering production, every preview URL and any future custom domain in one
policy — on Pages, previews and production need protecting separately, and a
missed preview is a public unlisted copy of the site.

**Consequence.** `.node-version` is honoured here, which it is not reliably on
Pages. GitHub Pages was kept live alongside, so there are two deployments of one
branch and a fallback if the Cloudflare setup needs unpicking.

---

## 17. `not_found_handling` left at its default

**Decision.** Not set to `single-page-application`, the usual choice for a React
app.

**Why.** SPA mode serves `index.html` for every unmatched path. This app has no
router — share state lives in `location.hash`, which never reaches the server —
so that would turn a mistyped URL into a silent, confusing copy of the app
instead of an honest 404.

---

## 18. The app name is a build-time variable

**Decision.** `VITE_APP_NAME` and `VITE_APP_DESCRIPTION`, defaults in a
committed `.env`, resolved in `src/appConfig.ts`.

**Rejected.** A runtime config fetch, which would add a request and a loading
state to a purely static site.

**Why.** One branch feeds two deployments that want different names. Build-time
injection keeps the bundle static and lets each host set its own name from its
own build settings.

**Consequence.** Download filenames derive from the name via `slugify()`, so a
rename does not leave exports called `flower-vase.png`. Names that slug to
nothing fall back, since an empty stem would download as a dotfile.

**Trap handled.** An unset GitHub Actions variable expands to `""` rather than
being absent, and Vite deliberately lets real environment variables outrank
`.env` — so an unset variable would have blanked the app name instead of
falling back to it. `vite.config.ts` drops blank `VITE_*` variables before Vite
reads them.

**Cost.** Values are substituted into `index.html` as raw text, so a literal `"`
or `<` in the name would corrupt the markup. Documented rather than escaped,
since the input is operator-controlled branding.

---

## 19. Tests that assert on share-link size must pin seeds

**Decision.** Share-size fixtures use deterministic seeds.

**Why.** Seeds are the least compressible part of the payload, so random seeds
make compressed length vary run to run. This was not theoretical: a 40-flower
link with no note already exceeded the 2000-character budget in roughly 1.8% of
samples, meaning CI had a latent flake before notes were added. It surfaced as
an unrelated-looking failure on an unrelated commit.

**Consequence.** The assertion that a hard-cap arrangement always fits was
false, and was replaced with three true ones: a soft-cap arrangement with a note
fits with margin, a note costs roughly its own length, and a hard-cap
arrangement with a note may exceed the budget but still decodes correctly.

**Generalisation.** An assertion that passes 98% of the time is worse than no
assertion, because it trains people to re-run CI.

---

## 20. `dev` integrates, `main` deploys

**Decision.** Work lands on `dev`, which runs CI; `main` is merged from `dev`
and triggers both deployments.

**Why.** `main` is wired to two live sites. Without a staging branch, every
commit is a deploy, and a failing typecheck is discovered in production.

**Cost.** Two steps to ship. Cheap, and it gives Cloudflare's preview builds
something to build.
