import { describe, expect, it } from 'vitest';
import {
  makeRoomWebSocketUrl,
  parseRoomMessage,
  type RoomSnapshot,
} from '../src/sync/protocol';

describe('shared room protocol', () => {
  it('parses a valid snapshot and keeps its revision', () => {
    const snapshot: RoomSnapshot = { kind: 'snapshot', revision: 4, doc: null, sourceId: 'client-a' };

    expect(parseRoomMessage(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('rejects malformed room messages', () => {
    expect(parseRoomMessage('not json')).toBeNull();
    expect(parseRoomMessage(JSON.stringify({ kind: 'snapshot', revision: -1, doc: null }))).toBeNull();
    expect(parseRoomMessage(JSON.stringify({ kind: 'snapshot', revision: 1, doc: null, sourceId: 42 }))).toBeNull();
    expect(parseRoomMessage(JSON.stringify({ kind: 'unknown' }))).toBeNull();
  });

  it('builds a websocket URL without losing the deployment path', () => {
    expect(makeRoomWebSocketUrl('https://vase.example.test/')).toBe('wss://vase.example.test/api/room');
    expect(makeRoomWebSocketUrl('http://localhost:5173/')).toBe('ws://localhost:5173/api/room');
  });
});
