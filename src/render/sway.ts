/**
 * The idle-sway engine.
 *
 * Deliberately lives OUTSIDE React. Every stem registers its animated `<g>` here
 * and a single requestAnimationFrame loop writes one `transform` attribute per
 * stem per frame. React never re-renders for animation, so the cost of the
 * animation is independent of component-tree size — this is what holds 60fps at
 * the 40-flower cap.
 *
 * Two summed sine waves at incommensurate frequencies, offset per stem by a
 * seed-derived phase, read as a breeze rather than a metronome. This is faked
 * motion, not a physical simulation — see `docs/decisions.md` for why.
 */

interface Entry {
  el: SVGGElement;
  phase: number;
  /** Peak rotation in degrees. */
  amp: number;
}

const entries = new Map<string, Entry>();
let rafId = 0;
let enabled = true;

function frame(now: number): void {
  const t = now / 1000;
  for (const e of entries.values()) {
    const a =
      e.amp *
      (Math.sin(t * 0.58 + e.phase) * 0.74 + Math.sin(t * 1.43 + e.phase * 1.9) * 0.26);
    e.el.setAttribute('transform', `rotate(${a.toFixed(3)})`);
  }
  rafId = requestAnimationFrame(frame);
}

function start(): void {
  if (rafId || !enabled || entries.size === 0) return;
  rafId = requestAnimationFrame(frame);
}

function stop(): void {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
}

/** Return every stem to upright — used when motion is switched off. */
function reset(): void {
  for (const e of entries.values()) e.el.setAttribute('transform', 'rotate(0)');
}

/**
 * Register (or update) a stem. Passing `el: null` unregisters, which is what a
 * React ref callback does on unmount.
 */
export function registerSway(
  id: string,
  el: SVGGElement | null,
  phase: number,
  amp: number,
): void {
  if (!el) {
    entries.delete(id);
    if (entries.size === 0) stop();
    return;
  }
  entries.set(id, { el, phase, amp });
  if (enabled) start();
  else el.setAttribute('transform', 'rotate(0)');
}

export function setSwayEnabled(next: boolean): void {
  enabled = next;
  if (enabled) start();
  else {
    stop();
    reset();
  }
}

export function isSwayEnabled(): boolean {
  return enabled;
}

/**
 * Sway amplitude from the flower's physical character: long light stems move a
 * lot, short heavy blooms barely at all.
 */
export function swayAmplitude(
  stemLength: number,
  headRadius: number,
  thickness: number,
): number {
  const raw = (1.5 + stemLength * 1.9) / (0.72 + thickness * 0.55) - headRadius * 0.028;
  return Math.max(0.5, Math.min(3.4, raw));
}

// Pause when the tab is hidden — rAF is usually throttled anyway, but this also
// stops us burning a frame budget on a backgrounded tab in some browsers.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
}
