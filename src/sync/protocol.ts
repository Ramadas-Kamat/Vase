import type { Doc } from '../types';

export const ROOM_API_PATH = '/api/room';
export const ROOM_ID = 'default';

export interface RoomSnapshot {
  kind: 'snapshot';
  revision: number;
  doc: Doc | null;
  sourceId?: string;
}

export interface RoomError {
  kind: 'error';
  code: string;
  message: string;
}

export interface RoomWriteMessage {
  kind: 'write';
  clientId: string;
  doc: Doc;
  initialize?: boolean;
}

export type RoomServerMessage = RoomSnapshot | RoomError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isRoomSnapshot(value: unknown): value is RoomSnapshot {
  if (!isRecord(value) || value.kind !== 'snapshot') return false;
  if (typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 0) {
    return false;
  }
  if (value.sourceId !== undefined && typeof value.sourceId !== 'string') return false;
  return value.doc === null || isRecord(value.doc);
}

export function isRoomError(value: unknown): value is RoomError {
  return (
    isRecord(value) &&
    value.kind === 'error' &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}

export function parseRoomMessage(raw: string): RoomServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (isRoomSnapshot(value) || isRoomError(value)) return value;
  return null;
}

export function makeRoomWebSocketUrl(locationHref: string): string {
  const url = new URL(ROOM_API_PATH, locationHref);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
