import { Router } from 'express';
import { notImplemented } from '../lib/http.js';

export type PlannedEndpoint = readonly ['get' | 'post' | 'put' | 'patch' | 'delete', string, string];

/**
 * Registers documented-but-unimplemented endpoints so clients get an honest
 * 501 NOT_IMPLEMENTED (behind auth) instead of a 404 or a fake success.
 * Module owners replace entries with real handlers as they implement them.
 */
export function plannedRouter(endpoints: readonly PlannedEndpoint[]): Router {
  const r = Router();
  for (const [method, path, feature] of endpoints) r[method](path, notImplemented(feature));
  return r;
}
