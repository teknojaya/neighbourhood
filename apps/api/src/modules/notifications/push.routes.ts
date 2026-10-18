import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../lib/db.js';
import { parseBody } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';

export function pushRouter(db: Db) {
  const r = Router();
  r.post('/notifications/push-tokens', async (req, res) => {
    const userId = authUser(req).userId;
    const body = parseBody(z.strictObject({ token: z.string().min(20).max(4096) }), req);
    const row = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const saved = await tx.pushToken.upsert({ where: { token: body.token }, create: { userId, token: body.token }, update: { userId, lastSeenAt: new Date() } });
      const old = await tx.pushToken.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' }, skip: 20, select: { id: true } });
      await tx.pushToken.deleteMany({ where: { userId, id: { in: old.map(t => t.id) } } });
      return saved;
    });
    res.status(201).json({ id: row.id });
  });
  r.delete('/notifications/push-tokens/:tokenId', async (req, res) => { await db.pushToken.deleteMany({ where: { id: uuidParam(req, 'tokenId'), userId: authUser(req).userId } }); res.sendStatus(204); });
  return r;
}
