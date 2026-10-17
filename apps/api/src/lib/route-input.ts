import type { Request } from 'express';
import { z } from 'zod';
import { HttpError } from './http.js';

/** Database-backed resource ids are UUIDs, even though legacy shared ids also allow slugs. */
export function uuidParam(req: Request, name: string) {
  const result = z.uuid().safeParse(req.params[name]);
  if (!result.success) throw new HttpError('VALIDATION_FAILED', `Invalid ${name}`);
  return result.data;
}
