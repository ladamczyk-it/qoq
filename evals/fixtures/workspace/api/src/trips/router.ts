import type { IStore } from './store.js';
import type { TNewTrip } from './types.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

type THandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const send = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readJson = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const isNewTrip = (value: unknown): value is TNewTrip =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as TNewTrip).name === 'string' &&
  typeof (value as TNewTrip).startsOn === 'string';

// GET /trips → 200 ITrip[]
// POST /trips { name, startsOn } → 201 ITrip | 400 { error }
export const tripsRouter =
  (store: IStore): THandler =>
  async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname !== '/trips') {
      return send(res, 404, { error: 'not found' });
    }
    if (req.method === 'GET') {
      return send(res, 200, store.list());
    }
    if (req.method === 'POST') {
      const body = await readJson(req).catch(() => undefined);
      if (!isNewTrip(body)) {
        return send(res, 400, { error: 'name and startsOn are required' });
      }
      return send(res, 201, store.add(body));
    }
    return send(res, 405, { error: 'method not allowed' });
  };
