/**
 * Autosave, boot-time document resolution, and JSON import/export.
 *
 * Boot precedence: share link (#a=…) > localStorage > first preset.
 * A share link wins because the user followed it deliberately; overriding it
 * with their own stored arrangement would make links appear broken.
 *
 * All storage access is wrapped: Safari private mode throws on `setItem`, and a
 * failed autosave must never take the app down.
 */
import type { Doc } from './types';
import { FILE_SLUG } from './appConfig';
import { normalizeDoc } from './lib/normalize';
import { readShareFromHash } from './lib/share';
import { defaultDoc } from './presets';

const KEY = 'dfv:doc:v1';
const SAVE_DEBOUNCE_MS = 400;

export type DocSource = 'share' | 'storage' | 'preset';

export interface BootResult {
  doc: Doc;
  source: DocSource;
  /** Flowers discarded during repair — surfaced to the user as a notice. */
  dropped: number;
}

export function resolveBootDoc(hash: string): BootResult {
  const shared = readShareFromHash(hash);
  if (shared) return { doc: shared.doc, source: 'share', dropped: shared.dropped };

  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const { doc, dropped } = normalizeDoc(JSON.parse(stored));
      return { doc, source: 'storage', dropped };
    }
  } catch {
    // Corrupt or unreadable storage: fall through to a preset rather than fail.
  }

  return { doc: defaultDoc(), source: 'preset', dropped: 0 };
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function saveDocDebounced(doc: Doc): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(doc));
    } catch {
      // Quota exceeded or private mode — autosave is best-effort by design.
    }
  }, SAVE_DEBOUNCE_MS);
}

export function clearSavedDoc(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}

// --- JSON file import / export ---------------------------------------------

export function downloadJson(doc: Doc, filename = `${FILE_SLUG}.json`): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  triggerDownload(URL.createObjectURL(blob), filename);
}

export async function readJsonFile(file: File): Promise<{ doc: Doc; dropped: number }> {
  const text = await file.text();
  return normalizeDoc(JSON.parse(text));
}

export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next macrotask so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
