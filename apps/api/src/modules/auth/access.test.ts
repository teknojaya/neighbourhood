import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Membership } from '@neighbourhood/shared';
import { errorHandler } from '../../lib/http.js';
import { FakeVerifier, InMemoryAccess, InMemoryUsers, bearer, userIdFor } from '../../test/fakes.js';
import { UserProvisioningService } from './users.js';
import { assertCommunityRole, canSetCommunityRole, hasCommunityRole, requirePlatformRole } from './access.js';
import { requireAuth } from './auth.js';

const m = (role: Membership['role'], status: Membership['status'] = 'active'): Membership => ({
  communityId: 'c1',
  userId: 'actor',
  role,
  status,
  grantedBy: null,
  updatedAt: '2026-10-01T00:00:00Z',
});

describe('community role checks', () => {
  it('ranks member < volunteer < moderator and ignores inactive memberships', () => {
    expect(hasCommunityRole(m('moderator'), 'volunteer')).toBe(true);
    expect(hasCommunityRole(m('member'), 'volunteer')).toBe(false);
    expect(hasCommunityRole(m('moderator', 'removed'), 'member')).toBe(false);
    expect(hasCommunityRole(m('volunteer', 'pending'), 'member')).toBe(false);
    expect(hasCommunityRole(null, 'member')).toBe(false);
  });

  it('assertCommunityRole throws FORBIDDEN for non-volunteers', async () => {
    const access = new InMemoryAccess();
    access.memberships.push(m('member'));
    await expect(assertCommunityRole(access, 'actor', 'c1', 'volunteer')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(assertCommunityRole(access, 'actor', 'other', 'member')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('role granting policy', () => {
  const base = { actorUserId: 'actor', targetUserId: 'target', actorIsStaff: false, currentTargetRole: 'member' as const };
  it('never lets users change their own role', () => {
    expect(canSetCommunityRole({ ...base, targetUserId: 'actor', actorMembership: m('moderator'), newRole: 'moderator' })).toBe(false);
    expect(canSetCommunityRole({ ...base, targetUserId: 'actor', actorMembership: m('member'), actorIsStaff: true, newRole: 'moderator' })).toBe(false);
  });
  it('lets moderators appoint volunteers but not moderators', () => {
    expect(canSetCommunityRole({ ...base, actorMembership: m('moderator'), newRole: 'volunteer' })).toBe(true);
    expect(canSetCommunityRole({ ...base, actorMembership: m('moderator'), newRole: 'moderator' })).toBe(false);
    expect(canSetCommunityRole({ ...base, actorMembership: m('moderator'), currentTargetRole: 'moderator', newRole: 'member' })).toBe(false);
  });
  it('denies members and volunteers', () => {
    expect(canSetCommunityRole({ ...base, actorMembership: m('volunteer'), newRole: 'volunteer' })).toBe(false);
    expect(canSetCommunityRole({ ...base, actorMembership: null, newRole: 'member' })).toBe(false);
  });
  it('lets platform staff appoint moderators', () => {
    expect(canSetCommunityRole({ ...base, actorMembership: null, actorIsStaff: true, newRole: 'moderator' })).toBe(true);
  });
});

describe('requirePlatformRole', () => {
  const build = (access: InMemoryAccess) => {
    const app = express();
    app.get('/category-editor', requireAuth(new FakeVerifier(), new UserProvisioningService(new InMemoryUsers())), requirePlatformRole(access, 'product_category_editor'), (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);
    return app;
  };
  it('allows only users holding the server-stored role', async () => {
    const access = new InMemoryAccess();
    access.roles.set(userIdFor('editor'), ['product_category_editor']);
    access.roles.set(userIdFor('staffer'), ['staff']);
    const app = build(access);
    await request(app).get('/category-editor').set('Authorization', bearer('editor')).expect(200);
    await request(app).get('/category-editor').set('Authorization', bearer('staffer')).expect(403);
    await request(app).get('/category-editor').set('Authorization', bearer('nobody')).expect(403);
    await request(app).get('/category-editor').expect(401);
  });
});
