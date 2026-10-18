import { randomBytes } from 'node:crypto';
import type { z } from 'zod';
import type {
  CreateCommunityBodySchema, CreatePointBodySchema, ProposeDepositBodySchema, ReviewDepositBodySchema, AdjustStockBodySchema} from '@neighbourhood/shared';
import { CommunitySchema, CommunityPointSchema, MembershipSchema, DepositSchema, PointInventoryItemSchema, StockAdjustmentSchema,
  type CommunityRole, approximateLocation, geohashFor } from '@neighbourhood/shared';
import type { Prisma } from '../../lib/db.js';
import { type Db, type Tx } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { assertCommunityRole, canSetCommunityRole, PrismaAccessRepository } from '../auth/access.js';
import { runIdempotent } from '../requests/idempotency.js';

const membershipDto = (row: { grantedById: string | null; updatedAt: Date; user?: { displayName: string | null } }) => MembershipSchema.parse({ ...row, displayName: row.user?.displayName, grantedBy: row.grantedById, updatedAt: row.updatedAt.toISOString() });
const depositDto = (row: { createdAt: Date; reviewedAt: Date | null; reviewedById: string | null }) => DepositSchema.parse({ ...row, createdAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null, reviewedBy: row.reviewedById });
export class CommunitiesService {
  constructor(private readonly db: Db) {}
  async list() { const rows = await this.db.community.findMany({ include: { _count: { select: { members: { where: { status: 'active' } } } } }, orderBy: { name: 'asc' }, take: 100 }); return { items: rows.map(row => CommunitySchema.parse({ ...row, createdAt: row.createdAt.toISOString(), memberCount: row._count.members })) }; }
  async get(userId: string, id: string) {
    const row = await this.db.community.findUnique({ where: { id }, include: { _count: { select: { members: { where: { status: 'active' } } } } } });
    if (!row) throw new HttpError('NOT_FOUND', 'Community not found');
    return { community: CommunitySchema.parse({ ...row, createdAt: row.createdAt.toISOString(), memberCount: row._count.members }), membership: await new PrismaAccessRepository(this.db).getMembership(id, userId) };
  }
  create(userId: string, key: string, body: z.infer<typeof CreateCommunityBodySchema>) {
    return runIdempotent(this.db, userId, key, 'community:create', body, async tx => {
      const roles = await new PrismaAccessRepository(tx).getPlatformRoles(userId);
      if (!roles.includes('staff')) throw new HttpError('FORBIDDEN', 'Community creation requires staff');
      const row = await tx.community.create({ data: { ...body, members: { create: { userId, role: 'moderator', status: 'active' } } } });
      return { status: 201, body: CommunitySchema.parse({ ...row, memberCount: 1, createdAt: row.createdAt.toISOString() }) };
    });
  }
  join(userId: string, key: string, id: string) {
    return runIdempotent(this.db, userId, key, `community:${id}:join`, {}, async tx => {
      await tx.$queryRaw`SELECT id FROM communities WHERE id = ${id}::uuid FOR UPDATE`;
      const community = await tx.community.findUnique({ where: { id } });
      if (!community) throw new HttpError('NOT_FOUND', 'Community not found');
      const where = { communityId_userId: { communityId: id, userId } };
      const existing = await tx.communityMembership.findUnique({ where });
      if (existing?.status === 'removed') throw new HttpError('FORBIDDEN', 'Ask a moderator to restore your membership');
      const row = existing ?? await tx.communityMembership.create({ data: { communityId: id, userId, role: 'member', status: community.joinPolicy === 'open' ? 'active' : 'pending' } });
      return { status: 200, body: membershipDto(row) };
    });
  }
  async members(userId: string, id: string) {
    await assertCommunityRole(new PrismaAccessRepository(this.db), userId, id, 'moderator');
    return { items: (await this.db.communityMembership.findMany({ where: { communityId: id }, include: { user: { select: { displayName: true } } }, take: 100, orderBy: { updatedAt: 'desc' } })).map(membershipDto) };
  }
  setMember(userId: string, key: string, id: string, target: string, body: { role?: CommunityRole; status?: 'active' | 'removed' }) {
    return runIdempotent(this.db, userId, key, `community:${id}:member:${target}`, body, async tx => {
      await tx.$queryRaw`SELECT id FROM communities WHERE id = ${id}::uuid FOR UPDATE`;
      const access = new PrismaAccessRepository(tx);
      const [actor, member, roles] = await Promise.all([access.getMembership(id, userId), access.getMembership(id, target), access.getPlatformRoles(userId)]);
      if (!member || !canSetCommunityRole({ actorUserId: userId, targetUserId: target, actorMembership: actor, actorIsStaff: roles.includes('staff'), currentTargetRole: member.role, newRole: body.role ?? member.role })) throw new HttpError('FORBIDDEN', 'Cannot change this membership');
      const row = await tx.communityMembership.update({ where: { communityId_userId: { communityId: id, userId: target } }, data: { role: body.role, status: body.status, grantedById: userId } });
      return { status: 200, body: membershipDto(row) };
    });
  }
  private pointDto(row: Prisma.CommunityPointGetPayload<object>) { return CommunityPointSchema.parse({ ...row, publicAddress: row.publicAddressConsent ? row.exactAddress : null, location: approximateLocation({ lat: row.lat, lng: row.lng }, row.areaLabel) }); }
  async points(id: string) { return { items: (await this.db.communityPoint.findMany({ where: { communityId: id, active: true }, take: 100 })).map(row => this.pointDto(row)) }; }
  async point(id: string) { const row = await this.db.communityPoint.findFirst({ where: { id, active: true } }); if (!row) throw new HttpError('NOT_FOUND', 'Point not found'); return this.pointDto(row); }
  async qr(qrId: string) { const row = await this.db.communityPoint.findUnique({ where: { qrId } }); if (!row?.active) throw new HttpError('NOT_FOUND', 'Point not found'); return this.pointDto(row); }
  createPoint(userId: string, key: string, id: string, body: z.infer<typeof CreatePointBodySchema>) {
    return runIdempotent(this.db, userId, key, `community:${id}:point`, body, async tx => {
      await assertCommunityRole(new PrismaAccessRepository(tx), userId, id, 'moderator');
      const { location, ...fields } = body;
      const row = await tx.communityPoint.create({ data: { ...fields, communityId: id, lat: location.lat, lng: location.lng, geohash: geohashFor(location), consentedAt: new Date(), qrId: randomBytes(18).toString('base64url') } });
      return { status: 201, body: this.pointDto(row) };
    });
  }
  async inventory(pointId: string) { const point = await this.db.communityPoint.findFirst({ where: { id: pointId, active: true } }); if (!point) throw new HttpError('NOT_FOUND', 'Point not found'); return { items: (await this.db.pointInventoryItem.findMany({ where: { pointId }, include: { listing: { select: { id: true } } }, take: 100, orderBy: { updatedAt: 'desc' } })).map(row => PointInventoryItemSchema.parse({ ...row, listingId: row.listing?.id ?? null, bestBefore: row.bestBefore?.toISOString().slice(0, 10) ?? null, updatedAt: row.updatedAt.toISOString() })) }; }
  private async volunteer(tx: Db | Tx, userId: string, pointId: string) {
    const point = await tx.communityPoint.findFirst({ where: { id: pointId, active: true } });
    if (!point) throw new HttpError('NOT_FOUND', 'Point not found');
    await assertCommunityRole(new PrismaAccessRepository(tx), userId, point.communityId, 'volunteer');
    return point;
  }
  async deposits(userId: string, pointId: string) {
    const point = await this.db.communityPoint.findUnique({ where: { id: pointId } });
    if (!point) throw new HttpError('NOT_FOUND', 'Point not found');
    const member = await new PrismaAccessRepository(this.db).getMembership(point.communityId, userId);
    const privileged = member?.status === 'active' && ['volunteer', 'moderator'].includes(member.role);
    return { items: (await this.db.deposit.findMany({ where: { pointId, ...(privileged ? {} : { donorId: userId }) }, orderBy: { createdAt: 'desc' }, take: 100 })).map(depositDto) };
  }
  propose(userId: string, key: string, body: z.infer<typeof ProposeDepositBodySchema>) {
    return runIdempotent(this.db, userId, key, `point:${body.pointId}:deposit`, body, async tx => {
      const point = await tx.communityPoint.findFirst({ where: { id: body.pointId, active: true } });
      if (!point) throw new HttpError('NOT_FOUND', 'Point not found');
      if (body.items.some(item => item.bestBefore && item.bestBefore < new Date().toISOString().slice(0, 10))) throw new HttpError('VALIDATION_FAILED', 'Expired items cannot be deposited');
      return { status: 201, body: depositDto(await tx.deposit.create({ data: { pointId: body.pointId, donorId: userId, items: body.items } })) };
    });
  }
  review(userId: string, key: string, id: string, body: z.infer<typeof ReviewDepositBodySchema>) {
    return runIdempotent(this.db, userId, key, `deposit:${id}:review`, body, async tx => {
      const initial = await tx.deposit.findUnique({ where: { id } });
      if (!initial) throw new HttpError('NOT_FOUND', 'Deposit not found');
      await tx.$queryRaw`SELECT id FROM community_points WHERE id = ${initial.pointId}::uuid FOR UPDATE`;
      await this.volunteer(tx, userId, initial.pointId);
      const row = await tx.deposit.findUniqueOrThrow({ where: { id } });
      if (row.status !== 'proposed') throw new HttpError('CONFLICT', 'Deposit has already been reviewed');
      const items = DepositSchema.shape.items.parse(row.items);
      if (body.to === 'accepted') {
        if (!body.acceptedQuantities || body.acceptedQuantities.length !== items.length || body.acceptedQuantities.some((n, i) => n > items[i]!.quantity)) throw new HttpError('VALIDATION_FAILED', 'Review each accepted quantity');
        for (const [index, item] of items.entries()) {
          const quantity = body.acceptedQuantities[index]!;
          if (!quantity) continue;
          if (item.bestBefore && item.bestBefore < new Date().toISOString().slice(0, 10)) throw new HttpError('CONFLICT', 'Do not accept expired items');
          const stock = await tx.pointInventoryItem.create({ data: { pointId: row.pointId, category: item.category, title: item.title, available: quantity, bestBefore: item.bestBefore ? new Date(item.bestBefore) : null } });
          await tx.stockAdjustment.create({ data: { pointId: row.pointId, itemId: stock.id, delta: quantity, reason: 'deposit_accepted', actorId: userId, depositId: id, note: body.reviewNote ?? null } });
        }
      }
      const updated = await tx.deposit.update({ where: { id }, data: { status: body.to, reviewedById: userId, reviewedAt: new Date(), reviewNote: body.reviewNote ?? null } });
      await tx.notification.create({ data: { userId: row.donorId, type: 'deposit_update', title: `Deposit ${body.to}`, body: 'A volunteer reviewed your deposit.', link: `/communities?point=${row.pointId}` } });
      return { status: 200, body: depositDto(updated) };
    });
  }
  adjust(userId: string, key: string, pointId: string, body: z.infer<typeof AdjustStockBodySchema>) {
    return runIdempotent(this.db, userId, key, `point:${pointId}:stock`, body, async tx => {
      await tx.$queryRaw`SELECT id FROM community_points WHERE id = ${pointId}::uuid FOR UPDATE`;
      await this.volunteer(tx, userId, pointId);
      const row = await tx.pointInventoryItem.findFirst({ where: { id: body.itemId, pointId } });
      if (!row || row.available + body.delta < 0) throw new HttpError('INSUFFICIENT_STOCK', 'Inventory cannot become negative');
      if (body.reason === 'collected' && row.bestBefore && row.bestBefore.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) throw new HttpError('CONFLICT', 'Record expired stock rather than collecting it');
      const listing = await tx.listing.findUnique({ where: { pointInventoryItemId: row.id } });
      if (listing) await tx.listing.update({ where: { id: listing.id }, data: body.reason === 'collected' ? { stockCollected: { increment: -body.delta } } : { stockTotal: { increment: body.delta } } });
      await tx.pointInventoryItem.update({ where: { id: row.id }, data: { available: { increment: body.delta } } });
      const audit = await tx.stockAdjustment.create({ data: { ...body, pointId, actorId: userId } });
      return { status: 200, body: StockAdjustmentSchema.parse({ ...audit, createdAt: audit.createdAt.toISOString() }) };
    });
  }
  async audit(userId: string, pointId: string) { await this.volunteer(this.db, userId, pointId); return { items: (await this.db.stockAdjustment.findMany({ where: { pointId }, orderBy: { createdAt: 'desc' }, take: 100 })).map(row => StockAdjustmentSchema.parse({ ...row, createdAt: row.createdAt.toISOString() })) }; }
}
