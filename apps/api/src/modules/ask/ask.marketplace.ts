import { type MarketplaceAction, type AskPart, MarketplaceActionSchema, modelSafe } from '@neighbourhood/shared';
import { z } from 'zod';
import type { Db } from '../../lib/db.js';
import type { ListingsService } from '../listings/listings.service.js';
import type { LoansService } from '../loans/loans.service.js';
import type { CommunitiesService } from '../communities/communities.service.js';
import { runIdempotent } from '../requests/idempotency.js';
import { HttpError } from '../../lib/http.js';
import { PrismaAccessRepository, assertCommunityRole, canSetCommunityRole } from '../auth/access.js';
import type { MatchingService } from '../needs/matching.service.js';
import { NeedsExtractionSchema } from '@neighbourhood/shared';

export interface MarketplaceServices { listings: ListingsService; loans: LoansService; communities: CommunitiesService; matching?: MatchingService }
export async function executeMarketplace(db: Db, services: MarketplaceServices, userId: string, key: string, action: MarketplaceAction) {
  const { listings, loans, communities } = services;
  switch (action.operation) {
    case 'saved_item_add': await runIdempotent(db, userId, key, 'ask:saved-item-add', action, async tx => { const { listing } = await listings.getListingDetail(userId, action.listingId); await tx.savedListing.upsert({ where: { userId_listingId: { userId, listingId: action.listingId } }, create: { userId, listingId: action.listingId, title: listing.title }, update: {} }); return { status: 200, body: { saved: true } }; }); return { message: 'Item saved', link: '/saved-items' };
    case 'saved_item_remove': await runIdempotent(db, userId, key, 'ask:saved-item-remove', action, async tx => { await tx.savedListing.deleteMany({ where: { userId, listingId: action.listingId } }); return { status: 200, body: { saved: false } }; }); return { message: 'Item removed from saved items', link: '/saved-items' };
    case 'listing_publish': { const listing = await listings.createListing(userId, action.body, key); return { message: 'Listing published', link: `/listings/${listing.id}` }; }
    case 'listing_edit': await listings.updateListing(userId, action.listingId, action.body, key, action.expectedUpdatedAt); return { message: 'Listing updated', link: `/listings/${action.listingId}` };
    case 'listing_transition': await listings.transitionStatus(userId, action.listingId, action.body.to, key, action.expectedUpdatedAt); return { message: `Listing ${action.body.to}`, link: `/listings/${action.listingId}` };
    case 'photo_delete': await listings.removePhoto(userId, action.listingId, action.photoId, key); return { message: 'Photo removed', link: `/listings/${action.listingId}` };
    case 'loan_request': { const result = await loans.create(userId, key, action.body); return { message: 'Loan requested for owner approval', link: `/activity?loan=${result.body.id}` }; }
    case 'loan_transition': await loans.transition(userId, key, action.loanId, action.body); return { message: `Loan ${action.body.to}`, link: `/activity?loan=${action.loanId}` };
    case 'community_join': await communities.join(userId, key, action.communityId); return { message: 'Join request processed', link: `/communities?community=${action.communityId}` };
    case 'community_create': { const result = await communities.create(userId, key, action.body); return { message: 'Community created', link: `/communities?community=${result.body.id}` }; }
    case 'point_create': await communities.createPoint(userId, key, action.communityId, action.body); return { message: 'Collection point created', link: `/communities?community=${action.communityId}` };
    case 'member_update': await communities.setMember(userId, key, action.communityId, action.userId, { role: action.role, status: action.status }); return { message: 'Membership updated', link: `/communities?community=${action.communityId}` };
    case 'deposit_propose': await communities.propose(userId, key, action.body); return { message: 'Deposit proposed; a volunteer must confirm it in person', link: `/communities?point=${action.body.pointId}` };
    case 'deposit_review': await communities.review(userId, key, action.depositId, action.body); return { message: `Deposit ${action.body.to}`, link: '/communities' };
    case 'stock_adjust': await communities.adjust(userId, key, action.pointId, action.body); return { message: 'Inventory adjustment recorded', link: `/communities?point=${action.pointId}` };
    case 'need_delete': await runIdempotent(db, userId, key, 'ask:need-delete', action, async tx => { await tx.need.deleteMany({ where: { id: action.needId, userId } }); return { status: 200, body: { removed: true } }; }); return { message: 'Saved need removed', link: '/needs/saved' };
    case 'notification_read': await runIdempotent(db, userId, key, 'ask:inbox-read', action, async tx => { const result = await tx.notification.updateMany({ where: { id: action.notificationId, userId }, data: { readAt: new Date() } }); if (!result.count) throw new HttpError('NOT_FOUND', 'Notification not found'); return { status: 200, body: { read: true } }; }); return { message: 'Notification marked read', link: '/notifications' };
    case 'profile_preferences': await runIdempotent(db, userId, key, 'ask:preferences', action, async tx => { await tx.user.update({ where: { id: userId }, data: { preferredLanguage: action.preferredLanguage, searchRadiusKm: action.searchRadiusKm } }); return { status: 200, body: { updated: true } }; }); return { message: 'Preferences updated', link: '/profile' };
  }
}
// Public model tools exclude secure address forms and publication. Those use UI proposals.
const publicEditSchema = MarketplaceActionSchema.options[1].extend({ body: MarketplaceActionSchema.options[1].shape.body.omit({ pickupInstructions: true }) });
const modelOptions = MarketplaceActionSchema.options.filter(schema => !['listing_publish', 'point_create', 'listing_edit'].includes(schema.shape.operation.value));
export const ModelMarketplaceActionSchema = z.discriminatedUnion('operation', [publicEditSchema, ...modelOptions]);
export const publicToolResult = (result: unknown, parts: AskPart[]) => ({ result: modelSafe(result), parts });

export async function authorizeProposal(db: Db, market: MarketplaceServices, userId: string, action: MarketplaceAction): Promise<MarketplaceAction> {
  const access = new PrismaAccessRepository(db);
  switch (action.operation) {
    case 'saved_item_add': await market.listings.getListingDetail(userId, action.listingId); break;
    case 'saved_item_remove': if (!await db.savedListing.count({ where: { userId, listingId: action.listingId } })) throw new HttpError('NOT_FOUND', 'Saved item not found'); break;
    case 'listing_edit': case 'listing_transition': { const { listing } = await market.listings.getListingDetail(userId, action.listingId); if (listing.ownerId !== userId) throw new HttpError('FORBIDDEN', 'Only the owner can manage this item'); return { ...action, expectedUpdatedAt: listing.updatedAt }; }
    case 'loan_request': { const { listing } = await market.listings.getListingDetail(userId, action.body.listingId); if (listing.mode !== 'lend' || listing.status !== 'active' || listing.ownerId === userId) throw new HttpError('CONFLICT', 'Item cannot be borrowed'); break; }
    case 'photo_delete': { const { listing } = await market.listings.getListingDetail(userId, action.listingId); if (listing.ownerId !== userId || !listing.photos.some(photo => photo.id === action.photoId)) throw new HttpError('NOT_FOUND', 'Photo unavailable'); break; }
    case 'loan_transition': { const loan = await market.loans.get(userId, action.loanId); if (!loan.allowedActions?.includes(action.body.to)) throw new HttpError('FORBIDDEN', 'This loan action is unavailable'); break; }
    case 'community_join': await market.communities.get(userId, action.communityId); break;
    case 'community_create': if (!(await access.getPlatformRoles(userId)).includes('staff')) throw new HttpError('FORBIDDEN', 'Community creation requires staff'); break;
    case 'point_create': await assertCommunityRole(access, userId, action.communityId, 'moderator'); break;
    case 'member_update': { const target = await access.getMembership(action.communityId, action.userId); if (!target || !canSetCommunityRole({ actorUserId: userId, targetUserId: action.userId, actorMembership: await access.getMembership(action.communityId, userId), actorIsStaff: (await access.getPlatformRoles(userId)).includes('staff'), currentTargetRole: target.role, newRole: action.role ?? target.role })) throw new HttpError('FORBIDDEN', 'Cannot change this member'); break; }
    case 'deposit_propose': await market.communities.inventory(action.body.pointId); break;
    case 'deposit_review': { const deposit = await db.deposit.findUnique({ where: { id: action.depositId }, include: { point: true } }); if (!deposit) throw new HttpError('NOT_FOUND', 'Deposit not found'); await assertCommunityRole(access, userId, deposit.point.communityId, 'volunteer'); if (deposit.status !== 'proposed') throw new HttpError('CONFLICT', 'Deposit already reviewed'); break; }
    case 'stock_adjust': await market.communities.audit(userId, action.pointId); if (!await db.pointInventoryItem.count({ where: { id: action.body.itemId, pointId: action.pointId } })) throw new HttpError('NOT_FOUND', 'Inventory item unavailable'); break;
    case 'need_delete': if (!await db.need.count({ where: { id: action.needId, userId } })) throw new HttpError('NOT_FOUND', 'Saved need not found'); break;
    case 'notification_read': if (!await db.notification.count({ where: { id: action.notificationId, userId } })) throw new HttpError('NOT_FOUND', 'Notification not found'); break;
    case 'profile_preferences': if (action.preferredLanguage === undefined && action.searchRadiusKm === undefined) throw new HttpError('VALIDATION_FAILED', 'Choose a preference'); break;
  }
  return action;
}

export async function marketplaceSummary(db: Db, market: MarketplaceServices, userId: string, action: MarketplaceAction): Promise<string> {
  let text = action.operation.replaceAll('_', ' ');
  switch (action.operation) {
    case 'saved_item_add': text = `Save ${(await market.listings.getListingDetail(userId, action.listingId)).listing.title}`; break;
    case 'saved_item_remove': text = `Remove ${(await db.savedListing.findFirstOrThrow({ where: { userId, listingId: action.listingId } })).title} from saved items`; break;
    case 'listing_publish': text = `Publish ${action.body.title} × ${action.body.quantity}`; break;
    case 'listing_edit': case 'listing_transition': case 'photo_delete': { const { listing } = await market.listings.getListingDetail(userId, action.listingId); text = action.operation === 'listing_transition' ? `${action.body.to}: ${listing.title}` : action.operation === 'photo_delete' ? `Remove photo ${listing.photos.findIndex(p => p.id === action.photoId) + 1} from ${listing.title}` : `Edit ${listing.title}`; break; }
    case 'loan_request': text = `Borrow ${(await market.listings.getListingDetail(userId, action.body.listingId)).listing.title}`; break;
    case 'loan_transition': text = `${action.body.to.replaceAll('_', ' ')}: ${(await market.loans.get(userId, action.loanId)).listingTitle}`; break;
    case 'community_join': text = `Join ${(await market.communities.get(userId, action.communityId)).community.name}`; break;
    case 'community_create': text = `Create ${action.body.name}`; break;
    case 'point_create': text = `Create ${action.body.name} for ${(await market.communities.get(userId, action.communityId)).community.name}`; break;
    case 'member_update': { const member = await db.user.findUniqueOrThrow({ where: { id: action.userId }, select: { displayName: true } }); text = `Update ${member.displayName ?? 'Neighbour'} in ${(await market.communities.get(userId, action.communityId)).community.name}`; break; }
    case 'deposit_propose': text = `Deposit ${action.body.items.map(i => `${i.title} × ${i.quantity}`).join(', ')}`; break;
    case 'deposit_review': { const row = await db.deposit.findUniqueOrThrow({ where: { id: action.depositId } }); const items = row.items as Array<{ title: string }>; text = `${action.body.to}: ${items.map(i => i.title).join(', ')}`; break; }
    case 'stock_adjust': text = `${action.body.delta > 0 ? '+' : ''}${action.body.delta} ${(await db.pointInventoryItem.findUniqueOrThrow({ where: { id: action.body.itemId } })).title}: ${action.body.reason}`; break;
    case 'need_delete': { const row = await db.need.findFirstOrThrow({ where: { id: action.needId, userId } }); text = `Remove saved need: ${NeedsExtractionSchema.parse(row.extraction).items.map(i => i.name).join(', ')}`; break; }
    case 'notification_read': text = `Mark read: ${(await db.notification.findFirstOrThrow({ where: { id: action.notificationId, userId } })).title}`; break;
  }
  return text.slice(0, 300);
}
