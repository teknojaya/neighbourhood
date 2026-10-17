import type { z } from 'zod';
import { allowedTargets, assertNoConflictingLoan, assertNotSelfRequest, assertTransition, assertValidRange, loanMachine,
  LoanSchema, type CreateLoanBodySchema, type LoanTransitionBodySchema } from '@neighbourhood/shared';
import { type Db, type Tx, pgErrorCode } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { beforeCursor, decodeCursor, pageRows, type PageOptions } from '../../lib/pagination.js';
import { runIdempotent } from '../requests/idempotency.js';
import { ConversationsStore } from '../conversations/conversations.store.js';

type Create = z.infer<typeof CreateLoanBodySchema>;
type Transition = z.infer<typeof LoanTransitionBodySchema>;
const include = { listing: { select: { title: true } }, conversation: { select: { id: true } } };
const iso = (d: Date) => d.toISOString().slice(0, 10);
export class LoansService {
  constructor(private readonly db: Db) {}
  private async read(tx: Db | Tx, userId: string, id: string) {
    const row = await tx.loan.findFirst({ where: { id, OR: [{ ownerId: userId }, { borrowerId: userId }] }, include });
    if (!row) throw new HttpError('NOT_FOUND', 'Loan not found');
    return LoanSchema.parse({ ...row, listingTitle: row.listing.title, overdue: row.status === 'checked_out' && iso(row.endDate) < iso(new Date()),
      startDate: iso(row.startDate), endDate: iso(row.endDate), checkedOutAt: row.checkedOutAt?.toISOString() ?? null,
      returnedAt: row.returnedAt?.toISOString() ?? null, conversationId: row.conversation?.id ?? null,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
      allowedActions: allowedTargets(loanMachine, row.status, row.ownerId === userId ? 'owner' : 'requester') });
  }
  get(userId: string, id: string) { return this.read(this.db, userId, id); }
  async list(userId: string, direction: 'incoming' | 'outgoing', opts: PageOptions) {
    const rows = await this.db.loan.findMany({ where: { ...(direction === 'incoming' ? { ownerId: userId } : { borrowerId: userId }), ...beforeCursor(decodeCursor(opts.cursor)) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: opts.limit + 1 });
    const page = pageRows(rows, opts.limit);
    return { ...page, items: await Promise.all(page.items.map(row => this.read(this.db, userId, row.id))) };
  }
  create(userId: string, key: string, body: Create) {
    return runIdempotent(this.db, userId, key, 'loan:create', body, async tx => {
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${body.listingId}::uuid FOR UPDATE`;
      const listing = await tx.listing.findUnique({ where: { id: body.listingId } });
      if (!listing || listing.status !== 'active' || listing.mode !== 'lend') throw new HttpError('CONFLICT', 'Item is not available to borrow');
      if (listing.bestBefore && iso(listing.bestBefore) < iso(new Date())) throw new HttpError('CONFLICT', 'Item is past its listed date');
      assertNotSelfRequest(listing.ownerId, userId);
      assertValidRange(body, listing.maxLoanDays ?? 90);
      if (body.startDate < iso(new Date())) throw new HttpError('VALIDATION_FAILED', 'Start date must be today or later');
      const row = await tx.loan.create({ data: { listingId: body.listingId, ownerId: listing.ownerId, borrowerId: userId, startDate: new Date(body.startDate), endDate: new Date(body.endDate), message: body.message } });
      const conversation = await new ConversationsStore(this.db).ensureForLoan(tx, row.id);
      if (body.message) await new ConversationsStore(this.db).sendInTransaction(tx, conversation.id, userId, body.message);
      await this.notify(tx, listing.ownerId, row.id, 'New loan request');
      return { status: 201, body: await this.read(tx, userId, row.id) };
    });
  }
  async transition(userId: string, key: string, id: string, body: Transition) {
    try { return await runIdempotent(this.db, userId, key, `loan:${id}:transition`, body, async tx => {
      const visible = await this.read(tx, userId, id);
      // All loan/listing transitions share the listing lock. Re-read after waiting.
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${visible.listingId}::uuid FOR UPDATE`;
      const row = await tx.loan.findUniqueOrThrow({ where: { id } });
      assertTransition(loanMachine, row.status, body.to, row.ownerId === userId ? 'owner' : 'requester');
      if (body.to === 'approved' || body.to === 'checked_out') {
        const listing = await tx.listing.findUniqueOrThrow({ where: { id: row.listingId } });
        if (listing.status !== 'active') throw new HttpError('CONFLICT', 'Listing is not active');
        assertValidRange({ startDate: iso(row.startDate), endDate: iso(row.endDate) }, listing.maxLoanDays ?? 90);
        if (iso(row.endDate) < iso(new Date())) throw new HttpError('CONFLICT', 'Loan dates have passed');
        const blocking = await tx.loan.findMany({ where: { listingId: row.listingId, id: { not: id }, status: { in: ['approved', 'checked_out'] } } });
        assertNoConflictingLoan({ id, startDate: iso(row.startDate), endDate: iso(row.endDate) }, blocking.map(b => ({ id: b.id, status: b.status, startDate: iso(b.startDate), endDate: iso(b.endDate) })), iso(new Date()));
        if (body.to === 'checked_out' && iso(row.startDate) > iso(new Date())) throw new HttpError('CONFLICT', 'Checkout starts on the approved start date');
      }
      await tx.loan.update({ where: { id }, data: { status: body.to, ...(body.to === 'checked_out' ? { checkedOutAt: new Date() } : {}), ...(body.to === 'returned' ? { returnedAt: new Date(), returnConditionNote: body.returnConditionNote ?? null } : {}) } });
      await this.notify(tx, row.ownerId === userId ? row.borrowerId : row.ownerId, id, `Loan ${body.to}`);
      return { status: 200, body: await this.read(tx, userId, id) };
    }); } catch (err) { if (pgErrorCode(err) === '23P01') throw new HttpError('CONFLICT', 'Loan dates overlap'); throw err; }
  }
  async availability(userId: string, id: string) {
    const listing = await this.db.listing.findUnique({ where: { id } });
    if (!listing || listing.mode !== 'lend' || (listing.status !== 'active' && listing.ownerId !== userId)) throw new HttpError('NOT_FOUND', 'Item not found');
    const loans = await this.db.loan.findMany({
      where: { listingId: id, status: { in: ['approved', 'checked_out'] } },
      select: { startDate: true, endDate: true, status: true },
      orderBy: { startDate: 'asc' },
    });
    const items = loans.map(row => ({
      startDate: iso(row.startDate),
      endDate: iso(row.endDate),
      status: row.status,
      checkedOut: row.status === 'checked_out',
    }));
    return { items, booked: items };
  }
  private notify(tx: Tx, userId: string, id: string, title: string) { return tx.notification.create({ data: { userId, type: 'loan_update', title, body: 'Your borrowing activity has an update.', link: `/activity?loan=${id}` } }); }
}
