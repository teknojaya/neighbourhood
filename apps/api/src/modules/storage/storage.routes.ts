import { Router } from 'express';
import { z } from 'zod';
import type { VerifiableObjectStorage } from '../../lib/storage.js';
import { HttpError, parseQuery } from '../../lib/http.js';

export function storageReadRouter(storage: VerifiableObjectStorage): Router {
  const r = Router();
  r.get('/storage/file', async (req, res) => {
    const q = parseQuery(z.object({ path: z.string().max(300), expires: z.string().max(20), signature: z.string().max(64) }), req);
    storage.verifyRead(q.path, q.expires, q.signature);
    try { res.set('Cache-Control', 'private, no-store').type('image/webp').send(await storage.get(q.path)); }
    catch { throw new HttpError('NOT_FOUND', 'Photo unavailable'); }
  });
  return r;
}
