/**
 * Top bar: history, presets, theme/motion, and everything that leaves the app
 * (PNG, SVG, JSON, share link).
 *
 * The export menu is a plain `<details>` element — keyboard-operable and
 * dismissible without a popover library.
 */
import { useRef, type ChangeEvent, type FC, type RefObject } from 'react';
import { useVase } from '../store/store';
import { PRESETS } from '../presets';
import { pngBlob } from '../export/exportPng';
import { svgBlob } from '../export/exportSvg';
import { downloadJson, readJsonFile, triggerDownload } from '../persistence';
import { buildShareUrl } from '../lib/share';

/** Beyond this, some clients (and older Windows browsers) truncate URLs. */
const SAFE_URL_LENGTH = 2000;

interface ToolbarProps {
  svgRef: RefObject<SVGSVGElement | null>;
  motion: boolean;
  onToggleMotion: () => void;
}

export const Toolbar: FC<ToolbarProps> = ({ svgRef, motion, onToggleMotion }) => {
  const doc = useVase((s) => s.doc);
  const past = useVase((s) => s.past);
  const future = useVase((s) => s.future);
  const undo = useVase((s) => s.undo);
  const redo = useVase((s) => s.redo);
  const randomize = useVase((s) => s.randomize);
  const clearFlowers = useVase((s) => s.clearFlowers);
  const applyPreset = useVase((s) => s.applyPreset);
  const setTheme = useVase((s) => s.setTheme);
  const loadDoc = useVase((s) => s.loadDoc);
  const notify = useVase((s) => s.notify);

  const fileInput = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  const closeMenu = () => menu.current?.removeAttribute('open');

  const exportPng = async () => {
    closeMenu();
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const blob = await pngBlob(svg);
      triggerDownload(URL.createObjectURL(blob), 'flower-vase.png');
      notify('Saved flower-vase.png');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'PNG export failed.', 'warn');
    }
  };

  const exportSvgFile = () => {
    closeMenu();
    const svg = svgRef.current;
    if (!svg) return;
    triggerDownload(URL.createObjectURL(svgBlob(svg)), 'flower-vase.svg');
    notify('Saved flower-vase.svg');
  };

  const exportJson = () => {
    closeMenu();
    downloadJson(doc);
    notify('Saved flower-vase.json');
  };

  const copyShareLink = async () => {
    closeMenu();
    const url = buildShareUrl(doc, window.location.href);
    if (url.length > SAFE_URL_LENGTH) {
      notify('This arrangement is too big for a link — use Save JSON instead.', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('Share link copied to the clipboard.');
    } catch {
      // Clipboard API needs a secure context and, in some browsers, permission.
      window.prompt('Copy this link:', url);
    }
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { doc: imported, dropped } = await readJsonFile(file);
      loadDoc(imported);
      notify(
        dropped > 0
          ? `Loaded, but ${dropped} stem${dropped === 1 ? '' : 's'} could not be read.`
          : 'Arrangement loaded.',
        dropped > 0 ? 'warn' : 'info',
      );
    } catch {
      notify("That file isn't a valid arrangement.", 'warn');
    }
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1 className="brand-name">Digital Flower Vase</h1>
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className="btn"
          onClick={undo}
          disabled={past.length === 0}
          title="Undo (⌘Z / Ctrl+Z)"
        >
          Undo
        </button>
        <button
          type="button"
          className="btn"
          onClick={redo}
          disabled={future.length === 0}
          title="Redo (⇧⌘Z / Ctrl+Shift+Z)"
        >
          Redo
        </button>
      </div>

      <div className="toolbar-group">
        <select
          className="select"
          aria-label="Load a starter arrangement"
          value=""
          onChange={(e) => {
            if (e.target.value) applyPreset(e.target.value);
          }}
        >
          <option value="">Starters…</option>
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={randomize} title="Generate a random arrangement">
          Surprise me
        </button>
        <button
          type="button"
          className="btn"
          onClick={clearFlowers}
          disabled={doc.flowers.length === 0}
          title="Remove every stem (undoable)"
        >
          Empty vase
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <span className="count" title="Soft limit 24, hard limit 40">
          {doc.flowers.length} stem{doc.flowers.length === 1 ? '' : 's'}
        </span>

        <button
          type="button"
          className="btn btn-icon"
          onClick={onToggleMotion}
          aria-pressed={motion}
          title={motion ? 'Turn off the breeze' : 'Turn on the breeze'}
        >
          {motion ? 'Breeze on' : 'Breeze off'}
        </button>

        <button
          type="button"
          className="btn btn-icon"
          onClick={() => setTheme(doc.theme === 'light' ? 'dark' : 'light')}
          title="Switch theme"
        >
          {doc.theme === 'light' ? 'Dark' : 'Light'}
        </button>

        <details className="menu" ref={menu}>
          <summary className="btn btn-primary">Share</summary>
          <div className="menu-panel" role="menu">
            <button type="button" role="menuitem" onClick={copyShareLink}>
              Copy link
            </button>
            <button type="button" role="menuitem" onClick={exportPng}>
              Download PNG
            </button>
            <button type="button" role="menuitem" onClick={exportSvgFile}>
              Download SVG
            </button>
            <hr />
            <button type="button" role="menuitem" onClick={exportJson}>
              Save JSON
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                fileInput.current?.click();
              }}
            >
              Open JSON…
            </button>
          </div>
        </details>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={importJson}
        />
      </div>
    </header>
  );
};
