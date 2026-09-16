import { useVase, type SyncStatus } from '../store/store';
import type { Doc } from '../types';
import {
  ROOM_API_PATH,
  isRoomSnapshot,
  makeRoomWebSocketUrl,
  parseRoomMessage,
  type RoomSnapshot,
  type RoomWriteMessage,
} from './protocol';

const WRITE_DELAY_MS = 120;
const RETRY_DELAY_MS = 3000;
const CLIENT_ID_KEY = 'dfv:sync:client-id';

export interface RoomSyncController {
  stop: () => void;
}

function getClientId(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    try {
      const existing = localStorage.getItem(CLIENT_ID_KEY);
      if (existing) return existing;
      const id = crypto.randomUUID();
      localStorage.setItem(CLIENT_ID_KEY, id);
      return id;
    } catch {
      return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
  }
}

function signature(doc: Doc): string {
  return JSON.stringify(doc);
}

async function readSnapshot(response: Response): Promise<RoomSnapshot> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('The shared room returned an unreadable response.');
  }
  if (!isRoomSnapshot(body)) {
    throw new Error('The shared room returned an invalid snapshot.');
  }
  return body;
}

export function startRoomSync(): RoomSyncController {
  let stopped = false;
  let socket: WebSocket | null = null;
  let unsubscribe: (() => void) | null = null;
  let retryTimer: number | undefined;
  let writeTimer: number | undefined;
  let revision = 0;
  let pendingDoc: Doc | null = null;
  let pendingWrites: string[] = [];
  const clientId = getClientId();

  const setState = (status: SyncStatus, message?: string) => {
    useVase.getState().setSyncState(status, message);
  };

  const clearRetry = () => {
    if (retryTimer !== undefined) {
      window.clearTimeout(retryTimer);
      retryTimer = undefined;
    }
  };

  const clearWrite = () => {
    if (writeTimer !== undefined) {
      window.clearTimeout(writeTimer);
      writeTimer = undefined;
    }
  };

  const closeSocket = () => {
    unsubscribe?.();
    unsubscribe = null;
    pendingDoc = null;
    pendingWrites = [];
    clearWrite();
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
  };

  const scheduleRetry = (status: 'offline' | 'error', message: string) => {
    if (stopped || retryTimer !== undefined) return;
    setState(status, message);
    retryTimer = window.setTimeout(() => {
      retryTimer = undefined;
      void connect();
    }, RETRY_DELAY_MS);
  };

  const sendWrite = (doc: Doc, initialize = false) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const payload: RoomWriteMessage = {
      kind: 'write',
      clientId,
      doc,
      ...(initialize ? { initialize: true } : {}),
    };
    pendingWrites.push(signature(doc));
    socket.send(JSON.stringify(payload));
    setState('saving');
  };

  const flushWrite = () => {
    writeTimer = undefined;
    if (!pendingDoc) return;
    const next = pendingDoc;
    pendingDoc = null;
    sendWrite(next);
  };

  const scheduleWrite = () => {
    if (writeTimer !== undefined) window.clearTimeout(writeTimer);
    writeTimer = window.setTimeout(flushWrite, WRITE_DELAY_MS);
  };

  const watchStore = () => {
    if (unsubscribe) return;
    unsubscribe = useVase.subscribe((state, previous) => {
      if (state.doc === previous.doc || stopped) return;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      pendingDoc = state.doc;
      scheduleWrite();
    });
  };

  const handleSnapshot = (snapshot: RoomSnapshot) => {
    if (snapshot.revision < revision) return;
    revision = snapshot.revision;
    const current = useVase.getState().doc;
    const currentSignature = signature(current);
    const incomingSignature = snapshot.doc ? signature(snapshot.doc) : null;
    const own = snapshot.sourceId === clientId;

    if (own) {
      const pendingIndex =
        incomingSignature === null ? -1 : pendingWrites.indexOf(incomingSignature);
      if (pendingIndex >= 0) pendingWrites.splice(pendingIndex, 1);

      if (
        snapshot.doc &&
        pendingDoc === null &&
        pendingWrites.length === 0 &&
        incomingSignature !== currentSignature
      ) {
        useVase.getState().applyRemoteDoc(snapshot.doc);
      }
      if (pendingDoc) scheduleWrite();
      if (pendingDoc === null && pendingWrites.length === 0) setState('live');
      return;
    }

    if (!snapshot.doc || pendingDoc || pendingWrites.length > 0) return;
    if (incomingSignature !== currentSignature) {
      useVase.getState().applyRemoteDoc(snapshot.doc);
      useVase.getState().notify('Someone else updated the shared vase.');
    }
    setState('live');
  };

  const openSocket = (initial: RoomSnapshot) => {
    try {
      socket = new WebSocket(makeRoomWebSocketUrl(window.location.href));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The live room could not open.';
      scheduleRetry('error', message);
      return;
    }

    socket.onopen = () => {
      if (stopped) return;
      watchStore();
      if (initial.doc === null) {
        sendWrite(useVase.getState().doc, true);
      } else {
        setState('live');
      }
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const message = parseRoomMessage(event.data);
      if (!message) {
        setState('error', 'The shared room sent an invalid message.');
        socket?.close(1011, 'Invalid room message.');
        return;
      }
      if (message.kind === 'error') {
        setState('error', message.message);
        socket?.close(1011, 'Room write failed.');
        return;
      }
      handleSnapshot(message);
    };

    socket.onerror = () => {
      if (!stopped) {
        setState('error', 'The live room connection failed.');
        socket?.close(1011, 'Room connection failed.');
      }
    };

    socket.onclose = () => {
      socket = null;
      unsubscribe?.();
      unsubscribe = null;
      pendingDoc = null;
      pendingWrites = [];
      clearWrite();
      scheduleRetry('offline', 'The shared vase is offline. Reconnecting…');
    };
  };

  async function connect(): Promise<void> {
    if (stopped) return;
    clearRetry();
    closeSocket();
    setState('connecting');

    let response: Response;
    try {
      response = await fetch(ROOM_API_PATH, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      });
    } catch {
      scheduleRetry('offline', 'The shared vase is offline. Reconnecting…');
      return;
    }

    if (stopped) return;
    if (response.status === 404) {
      setState('local');
      return;
    }
    if (!response.ok) {
      scheduleRetry('error', `The shared room returned HTTP ${response.status}.`);
      return;
    }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      if (!response.redirected) {
        setState('local');
        return;
      }
      scheduleRetry('error', 'Sign in through Cloudflare Access to open the shared vase.');
      return;
    }

    let snapshot: RoomSnapshot;
    try {
      snapshot = await readSnapshot(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The shared room returned an invalid response.';
      scheduleRetry('error', message);
      return;
    }

    revision = snapshot.revision;
    if (snapshot.doc) useVase.getState().applyRemoteDoc(snapshot.doc);
    openSocket(snapshot);
  }

  const onOffline = () => {
    if (stopped) return;
    closeSocket();
    scheduleRetry('offline', 'The shared vase is offline. Reconnecting…');
  };
  const onOnline = () => {
    if (stopped) return;
    clearRetry();
    void connect();
  };

  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);
  void connect();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearRetry();
      clearWrite();
      closeSocket();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      useVase.getState().setSyncState('local');
    },
  };
}
