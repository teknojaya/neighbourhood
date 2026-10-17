import { Router } from 'express';
import { PageQuerySchema, SavedItemSchema } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { HttpError, parseQuery } from '../../lib/http.js';
import { beforeCursor, decodeCursor, pageRows } from '../../lib/pagination.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import type { ListingsService } from './listings.service.js';
export function savedItemsRouter(db: Db, listings: ListingsService) {
  const r = Router();
  r.get('/saved-items/ids', async (req, res) => { res.json({ ids: (await db.savedListing.findMany({ where: { userId: authUser(req).userId }, select: { listingId: true } })).map(row => row.listingId) }); });
  r.get('/saved-items', async (req, res) => {
    const userId = authUser(req).userId; const query = parseQuery(PageQuerySchema, req);
    const page = pageRows(await db.savedListing.findMany({ where: { userId, ...beforeCursor(decodeCursor(query.cursor)) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 }), query.limit);
    const items = await Promise.all(page.items.map(async row => { let listing = null; try { listing = (await listings.getListingDetail(userId, row.listingId)).listing; } catch (err) { if (!(err instanceof HttpError && ['NOT_FOUND','FORBIDDEN'].includes(err.code))) throw err; } return SavedItemSchema.parse({ ...row, createdAt: row.createdAt.toISOString(), listing }); }));
    res.json({ items, nextCursor: page.nextCursor });
  });
  r.put('/saved-items/:listingId', async (req, res) => { const userId = authUser(req).userId, listingId = uuidParam(req, 'listingId'); const { listing } = await listings.getListingDetail(userId, listingId); await db.savedListing.upsert({ where: { userId_listingId: { userId, listingId } }, create: { userId, listingId, title: listing.title }, update: {} }); res.json({ saved: true }); });
  r.delete('/saved-items/:listingId', async (req, res) => { await db.savedListing.deleteMany({ where: { userId: authUser(req).userId, listingId: uuidParam(req, 'listingId') } }); res.json({ saved: false }); });
  return r;
}
