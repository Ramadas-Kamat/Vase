/**
 * Boot sequence.
 *
 *   1. Populate the catalog registry (must happen before the store is created).
 *   2. Resolve the starting document: share link > localStorage > first preset.
 *   3. Mount.
 *
 * Step 2 runs before the first render so there is no flash of the default
 * arrangement before the user's own is swapped in.
 */
import './catalog';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useVase } from './store/store';
import { resolveBootDoc } from './persistence';
// theme.css first: it declares the custom properties the other two consume.
import './styles/theme.css';
import './styles/base.css';
import './styles/panel.css';

const boot = resolveBootDoc(window.location.hash);
useVase.getState().loadDoc(boot.doc, { resetHistory: true });

if (boot.dropped > 0) {
  useVase
    .getState()
    .notify(
      `${boot.dropped} stem${boot.dropped === 1 ? '' : 's'} in that arrangement could not be read and were skipped.`,
      'warn',
    );
} else if (boot.source === 'share') {
  useVase.getState().notify('Opened a shared arrangement. Edit it freely — it saves locally.');
}

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
