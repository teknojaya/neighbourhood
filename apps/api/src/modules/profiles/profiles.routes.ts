import { Router } from 'express';
import { UpsertProfileBodySchema } from '@neighbourhood/shared';
import { parseBody } from '../../lib/http.js';
import { authUser } from '../auth/auth.js';
import type { ProfilesService } from './profiles.service.js';

export function profilesRouter(service: ProfilesService): Router {
  const r = Router();
  r.get('/me', async (req, res) => {
    res.json(await service.getMe(authUser(req)));
  });
  r.put('/me/profile', async (req, res) => {
    const body = parseBody(UpsertProfileBodySchema, req);
    res.json(await service.upsertProfile(authUser(req), body));
  });
  return r;
}
