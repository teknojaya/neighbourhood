import type { RequestHandler } from 'express';
import type { CommunityRole, Membership, PlatformRole } from '@neighbourhood/shared';
import type { Db, Tx } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { authUser } from './auth.js';

/**
 * Server-controlled authorization data (PostgreSQL):
 *   user_roles              platform roles, written by operator tooling only
 *   community_memberships   community roles, written by the server only
 * Every service must check access through this repository.
 */
export interface AccessRepository {
  getPlatformRoles(userId: string): Promise<PlatformRole[]>;
  getMembership(communityId: string, userId: string): Promise<Membership | null>;
  listActiveMemberships(userId: string): Promise<Membership[]>;
}

type MembershipRow = {
  communityId: string;
  userId: string;
  role: CommunityRole;
  status: Membership['status'];
  grantedById: string | null;
  updatedAt: Date;
};

const toMembership = (m: MembershipRow): Membership => ({
  communityId: m.communityId,
  userId: m.userId,
  role: m.role,
  status: m.status,
  grantedBy: m.grantedById,
  updatedAt: m.updatedAt.toISOString(),
});

export class PrismaAccessRepository implements AccessRepository {
  /** Accepts the root client or a transaction client. */
  constructor(private readonly db: Db | Tx) {}

  async getPlatformRoles(userId: string): Promise<PlatformRole[]> {
    const rows = await this.db.userRole.findMany({ where: { userId }, select: { role: true } });
    return rows.map((r) => r.role);
  }

  async getMembership(communityId: string, userId: string): Promise<Membership | null> {
    const m = await this.db.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId } } });
    return m ? toMembership(m) : null;
  }

  async listActiveMemberships(userId: string): Promise<Membership[]> {
    const rows = await this.db.communityMembership.findMany({ where: { userId, status: 'active' }, take: 100 });
    return rows.map(toMembership);
  }
}

const RANK: Record<CommunityRole, number> = { member: 0, volunteer: 1, moderator: 2 };

export function hasCommunityRole(m: Membership | null, minimum: CommunityRole): boolean {
  return m !== null && m.status === 'active' && RANK[m.role] >= RANK[minimum];
}

export async function assertCommunityRole(
  access: AccessRepository,
  userId: string,
  communityId: string,
  minimum: CommunityRole,
): Promise<Membership> {
  const m = await access.getMembership(communityId, userId);
  if (!m || !hasCommunityRole(m, minimum)) {
    throw new HttpError('FORBIDDEN', `Requires ${minimum} role in this community`);
  }
  return m;
}

/**
 * Role-granting policy:
 * - Nobody changes their own role.
 * - Moderators may set member/volunteer for others in their community.
 * - Only platform staff may grant or remove moderator.
 */
export function canSetCommunityRole(params: {
  actorUserId: string;
  targetUserId: string;
  actorMembership: Membership | null;
  actorIsStaff: boolean;
  currentTargetRole: CommunityRole | null;
  newRole: CommunityRole;
}): boolean {
  const { actorUserId, targetUserId, actorMembership, actorIsStaff, currentTargetRole, newRole } = params;
  if (!(newRole in RANK)) return false;
  if (actorUserId === targetUserId) return false;
  if (actorIsStaff) return true;
  if (!hasCommunityRole(actorMembership, 'moderator')) return false;
  if (newRole === 'moderator' || currentTargetRole === 'moderator') return false;
  return true;
}

export function requirePlatformRole(access: AccessRepository, role: PlatformRole): RequestHandler {
  return async (req, _res, next) => {
    try {
      const roles = await access.getPlatformRoles(authUser(req).userId);
      if (!roles.includes(role)) return next(new HttpError('FORBIDDEN', 'Insufficient permissions'));
      next();
    } catch (err) {
      next(err);
    }
  };
}
