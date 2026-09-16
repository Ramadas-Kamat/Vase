import type { DurableObjectState } from '@cloudflare/workers-types';
import '../src/catalog';
import { normalizeDoc } from '../src/lib/normalize';
import type { Doc } from '../src/types';
import type { RoomError, RoomServerMessage, RoomSnapshot } from '../src/sync/protocol';

const SNAPSHOT_KEY = 'snapshot';
const MAX_WRITE_BYTES = 128 * 1024;

interface StoredSnapshot {
  revision: number;
  doc: Doc;
}

interface WritePayload {
  doc: unknown;
  clientId?: string;
  initialize?: boolean;
}

interface WriteResult {
  snapshot: StoredSnapshot;
  accepted: boolean;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function errorMessage(code: string, message: string, status: number): Response {
  const body: RoomError = { kind: 'error', code, message };
  return json(body, status);
}

function asWritePayload(value: unknown): WritePayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const payload = value as Partial<WritePayload>;
  if (!('doc' in payload)) return null;
  if (payload.clientId !== undefined && typeof payload.clientId !== 'string') return null;
  if (payload.initialize !== undefined && typeof payload.initialize !== 'boolean') return null;
  return {
    doc: payload.doc,
    clientId: payload.clientId,
    initialize: payload.initialize,
  };
}

function snapshotMessage(snapshot: StoredSnapshot | null, sourceId?: string): RoomSnapshot {
  return {
    kind: 'snapshot',
    revision: snapshot?.revision ?? 0,
    doc: snapshot?.doc ?? null,
    ...(sourceId ? { sourceId } : {}),
  };
}

export class VaseRoom {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return this.openSocket();
    }

    if (request.method === 'GET') {
      return json(snapshotMessage(await this.readSnapshot()));
    }

    if (request.method === 'PUT') {
      return this.handleHttpWrite(request);
    }

    return errorMessage('method_not_allowed', 'Only GET, PUT, and WebSocket requests are supported.', 405);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') {
      this.sendError(socket, 'invalid_message', 'Room messages must be JSON text.');
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      this.sendError(socket, 'invalid_message', 'That room message is not valid JSON.');
      return;
    }

    const payload = asWritePayload(raw);
    if (!payload || typeof payload.clientId !== 'string' || payload.clientId.length === 0) {
      this.sendError(socket, 'invalid_message', 'A client id and document are required.');
      return;
    }

    try {
      const result = await this.applyWrite(payload.doc, payload.clientId, payload.initialize === true);
      // A second client can initialize an empty room after another client has
      // already won the race. It still needs a targeted acknowledgement because
      // the winning write was broadcast before this request arrived.
      if (payload.initialize === true && !result.accepted) {
        socket.send(JSON.stringify(snapshotMessage(result.snapshot, payload.clientId)));
      }
    } catch {
      this.sendError(socket, 'write_failed', 'The vase could not be saved. Please try again.');
    }
  }

  private async handleHttpWrite(request: Request): Promise<Response> {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_WRITE_BYTES) {
      return errorMessage('payload_too_large', 'That arrangement is too large to save.', 413);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      return errorMessage('invalid_json', 'The request body is not valid JSON.', 400);
    }

    const payload = asWritePayload(raw);
    if (!payload) return errorMessage('invalid_message', 'A document is required.', 400);

    try {
      const result = await this.applyWrite(payload.doc, payload.clientId, payload.initialize === true);
      return json(snapshotMessage(result.snapshot, payload.clientId));
    } catch {
      return errorMessage('write_failed', 'The vase could not be saved. Please try again.', 500);
    }
  }

  private async readSnapshot(): Promise<StoredSnapshot | null> {
    return (await this.state.storage.get<StoredSnapshot>(SNAPSHOT_KEY)) ?? null;
  }

  private async applyWrite(
    rawDoc: unknown,
    sourceId: string | undefined,
    initialize: boolean,
  ): Promise<WriteResult> {
    const current = await this.readSnapshot();
    if (initialize && current) return { snapshot: current, accepted: false };

    const next: StoredSnapshot = {
      revision: (current?.revision ?? 0) + 1,
      doc: normalizeDoc(rawDoc).doc,
    };
    await this.state.storage.put(SNAPSHOT_KEY, next);
    await this.broadcast(snapshotMessage(next, sourceId));
    return { snapshot: next, accepted: true };
  }

  private async openSocket(): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify(snapshotMessage(await this.readSnapshot())));
    return new Response(null, { status: 101, webSocket: client });
  }

  private async broadcast(message: RoomServerMessage): Promise<void> {
    const payload = JSON.stringify(message);
    for (const socket of this.state.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        socket.close(1011, 'Room connection failed.');
      }
    }
  }

  private sendError(socket: WebSocket, code: string, message: string): void {
    const body: RoomError = { kind: 'error', code, message };
    socket.send(JSON.stringify(body));
  }
}
