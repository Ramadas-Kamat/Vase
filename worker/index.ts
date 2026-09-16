import type { DurableObjectNamespace, Fetcher } from '@cloudflare/workers-types';
import { ROOM_API_PATH, ROOM_ID } from '../src/sync/protocol';
import { VaseRoom } from './room';

interface Env {
  ASSETS: Fetcher;
  VASE_ROOM: DurableObjectNamespace;
}

export { VaseRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === ROOM_API_PATH) {
      const id = env.VASE_ROOM.idFromName(ROOM_ID);
      return env.VASE_ROOM.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
