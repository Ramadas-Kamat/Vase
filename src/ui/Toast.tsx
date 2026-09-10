/** Transient status messages. Auto-dismissing, non-blocking, one at a time. */
import { useEffect, type FC } from 'react';
import { useVase } from '../store/store';

const DISMISS_MS = 3400;

export const Toast: FC = () => {
  const notice = useVase((s) => s.notice);
  const dismiss = useVase((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismiss, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, dismiss]);

  if (!notice) return null;

  return (
    <div className={`toast toast-${notice.tone}`} role="status" aria-live="polite">
      <span>{notice.text}</span>
      <button type="button" className="toast-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
};
