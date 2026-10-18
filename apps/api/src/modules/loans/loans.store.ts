import {
  type Actor,
  assertNoConflictingLoan,
  assertNotSelfRequest,
  assertTransition,
  assertValidRange,
  DomainError,
  type LoanStatus,
  loanMachine,
} from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { pgErrorCode } from '../../lib/db.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * PostgreSQL persistence for single-unit loans.
 *
 * Approval locks the listing row (FOR UPDATE), which serializes all approvals
 * for that item, then checks overlaps with assertNoConflictingLoan (covers
 * overdue checked-out loans). The `loans_no_overlap` exclusion constraint
 * (btree_gist, daterange &&) is the database backstop: 23P01 → CONFLICT.
 */
export class LoansStore {
  constructor(private readonly db: Db) {}

  async create(input: { listingId: string; borrowerId: string; startDate: string; endDate: string; message: string }) {
    const listing = await this.db.listing.findUnique({
      where: { id: input.listingId },
      select: { ownerId: true, status: true, mode: true, maxLoanDays: true },
    });
    if (!listing || listing.status !== 'active' || listing.mode !== 'lend') {
      throw new DomainError('CONFLICT', 'This item is not available to borrow');
    }
    assertNotSelfRequest(listing.ownerId, input.borrowerId);
    assertValidRange(input, listing.maxLoanDays ?? 90);
    return this.db.loan.create({
      data: {
        listingId: input.listingId,
        ownerId: listing.ownerId,
        borrowerId: input.borrowerId,
        startDate: new Date(`${input.startDate}T00:00:00Z`),
        endDate: new Date(`${input.endDate}T00:00:00Z`),
        message: input.message,
      },
    });
  }

  async transition(loanId: string, actorUserId: string, to: Exclude<LoanStatus, 'pending'>, opts: { today: string; returnConditionNote?: string }) {
    try {
      return await this.db.$transaction(async (tx) => {
        const loan = await tx.loan.findUnique({ where: { id: loanId } });
        if (!loan) throw new DomainError('BAD_REQUEST', 'Loan not found');
        // Serialize all transitions for this item, then re-read the loan.
        await tx.$queryRaw`SELECT id FROM listings WHERE id = ${loan.listingId}::uuid FOR UPDATE`;
        const current = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });

        const actor: Actor =
          actorUserId === current.ownerId ? 'owner' : actorUserId === current.borrowerId ? 'requester' : 'system';
        if (actor === 'system') throw new DomainError('FORBIDDEN', 'You are not a participant in this loan');
        assertTransition(loanMachine, current.status, to, actor);

        if (to === 'approved') {
          const blocking = await tx.loan.findMany({
            where: { listingId: current.listingId, status: { in: ['approved', 'checked_out'] }, id: { not: current.id } },
            select: { id: true, status: true, startDate: true, endDate: true },
          });
          assertNoConflictingLoan(
            { id: current.id, startDate: iso(current.startDate), endDate: iso(current.endDate) },
            blocking.map((b) => ({ id: b.id, status: b.status, startDate: iso(b.startDate), endDate: iso(b.endDate) })),
            opts.today,
          );
        }

        const now = new Date();
        return tx.loan.update({
          where: { id: loanId },
          data: {
            status: to,
            ...(to === 'checked_out' ? { checkedOutAt: now } : {}),
            ...(to === 'returned' ? { returnedAt: now, returnConditionNote: opts.returnConditionNote ?? null } : {}),
          },
        });
      });
    } catch (err) {
      if (pgErrorCode(err) === '23P01') throw new DomainError('CONFLICT', 'Item is already lent for these dates');
      throw err;
    }
  }

  /**
   * Retrieves active/approved date ranges for a listing to prevent double booking.
   */
  async getBookedDates(listingId: string): Promise<Array<{ startDate: string; endDate: string; status: LoanStatus }>> {
    const today = iso(new Date());
    const loans = await this.db.loan.findMany({
      where: {
        listingId,
        status: { in: ['approved', 'checked_out'] },
      },
      select: {
        startDate: true,
        endDate: true,
        status: true,
      },
      orderBy: { startDate: 'asc' },
    });

    return loans.map((l) => ({
      startDate: iso(l.startDate),
      endDate: l.status === 'checked_out' && iso(l.endDate) < today ? today : iso(l.endDate),
      status: l.status,
    }));
  }

  /**
   * Retrieves incoming loan requests and active loans for the item owner.
   */
  async getIncoming(ownerId: string) {
    const now = new Date();
    const records = await this.db.loan.findMany({
      where: { ownerId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            category: true,
            photos: { take: 1, orderBy: { position: 'asc' } },
          },
        },
        borrower: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      listingId: r.listingId,
      ownerId: r.ownerId,
      borrowerId: r.borrowerId,
      borrowerName: r.borrower.displayName ?? 'Neighbour',
      listingTitle: r.listing.title,
      listingCategory: r.listing.category,
      listingPhoto: r.listing.photos[0]?.storagePath
        ? `/api/v1/storage/file?path=${encodeURIComponent(r.listing.photos[0].storagePath)}`
        : null,
      startDate: iso(r.startDate),
      endDate: iso(r.endDate),
      status: r.status,
      overdue: r.status === 'checked_out' && iso(r.endDate) < iso(now),
      checkedOutAt: r.checkedOutAt?.toISOString() ?? null,
      returnedAt: r.returnedAt?.toISOString() ?? null,
      returnConditionNote: r.returnConditionNote,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Retrieves outgoing loan requests and active loans for the borrower.
   */
  async getOutgoing(borrowerId: string) {
    const now = new Date();
    const records = await this.db.loan.findMany({
      where: { borrowerId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            category: true,
            photos: { take: 1, orderBy: { position: 'asc' } },
          },
        },
        owner: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      listingId: r.listingId,
      ownerId: r.ownerId,
      borrowerId: r.borrowerId,
      ownerName: r.owner.displayName ?? 'Neighbour',
      listingTitle: r.listing.title,
      listingCategory: r.listing.category,
      listingPhoto: r.listing.photos[0]?.storagePath
        ? `/api/v1/storage/file?path=${encodeURIComponent(r.listing.photos[0].storagePath)}`
        : null,
      startDate: iso(r.startDate),
      endDate: iso(r.endDate),
      status: r.status,
      overdue: r.status === 'checked_out' && iso(r.endDate) < iso(now),
      checkedOutAt: r.checkedOutAt?.toISOString() ?? null,
      returnedAt: r.returnedAt?.toISOString() ?? null,
      returnConditionNote: r.returnConditionNote,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Retrieves single loan detail ensuring caller is participant.
   */
  async getById(loanId: string, userId: string) {
    const now = new Date();
    const record = await this.db.loan.findUnique({
      where: { id: loanId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            category: true,
            photos: { take: 1, orderBy: { position: 'asc' } },
          },
        },
        owner: { select: { id: true, displayName: true } },
        borrower: { select: { id: true, displayName: true } },
      },
    });

    if (!record) throw new DomainError('BAD_REQUEST', 'Loan not found');
    if (record.ownerId !== userId && record.borrowerId !== userId) {
      throw new DomainError('FORBIDDEN', 'You are not a participant in this loan');
    }

    return {
      id: record.id,
      listingId: record.listingId,
      ownerId: record.ownerId,
      borrowerId: record.borrowerId,
      ownerName: record.owner.displayName ?? 'Neighbour',
      borrowerName: record.borrower.displayName ?? 'Neighbour',
      listingTitle: record.listing.title,
      listingCategory: record.listing.category,
      listingPhoto: record.listing.photos[0]?.storagePath
        ? `/api/v1/storage/file?path=${encodeURIComponent(record.listing.photos[0].storagePath)}`
        : null,
      startDate: iso(record.startDate),
      endDate: iso(record.endDate),
      status: record.status,
      overdue: record.status === 'checked_out' && iso(record.endDate) < iso(now),
      checkedOutAt: record.checkedOutAt?.toISOString() ?? null,
      returnedAt: record.returnedAt?.toISOString() ?? null,
      returnConditionNote: record.returnConditionNote,
      message: record.message,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
