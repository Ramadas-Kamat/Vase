import type { FC } from 'react';
import { useVase } from '../store/store';

const LABELS = {
  local: 'Local only',
  connecting: 'Connecting…',
  live: 'Live',
  saving: 'Saving…',
  offline: 'Offline',
  error: 'Sync unavailable',
} as const;

export const SyncStatus: FC = () => {
  const status = useVase((s) => s.syncStatus);
  const message = useVase((s) => s.syncMessage);

  return (
    <div
      className={`sync-status sync-status-${status}`}
      role="status"
      aria-live="polite"
      title={message ?? LABELS[status]}
    >
      <span className="sync-status-dot" aria-hidden="true" />
      <span>{LABELS[status]}</span>
    </div>
  );
};
