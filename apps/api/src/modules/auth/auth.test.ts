import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, userIdFor } from '../../test/fakes.js';

describe('authentication', () => {
  it('serves the health endpoint without auth', async () => {
    const { app } = buildTestApp();
    await request(app).get('/healthz').expect(200, { status: 'ok' });
  });

  it('rejects API calls without a bearer token or with an invalid one', async () => {
    const { app } = buildTestApp();
    expect((await request(app).get('/api/v1/me').expect(401)).body.error.code).toBe('UNAUTHENTICATED');
    await request(app).get('/api/v1/me').set('Authorization', bearer('invalid')).expect(401);
    await request(app).get('/api/v1/me').set('Authorization', 'Basic dXNlcjpwYXNzd29yZA==').expect(401);
  });

  it('accepts only Google and email-OTP (custom token) sign-ins', async () => {
    const { app } = buildTestApp();
    await request(app).get('/api/v1/me').set('Authorization', bearer('g1', 'google.com')).expect(200);
    const otp = await request(app).get('/api/v1/me').set('Authorization', bearer('o1', 'custom')).expect(200);
    expect(otp.body.signInMethod).toBe('email_otp');
    for (const provider of ['password', 'anonymous', 'phone']) {
      const res = await request(app).get('/api/v1/me').set('Authorization', bearer(`x-${provider}`, provider)).expect(403);
      expect(res.body.error.code).toBe('UNSUPPORTED_SIGN_IN_METHOD');
    }
  });

  it('requires auth before revealing even unimplemented routes', async () => {
    const { app } = buildTestApp();
    await request(app).get('/api/v1/listings').expect(401);
    const res = await request(app).get('/api/v1/listings').set('Authorization', bearer('alice')).expect(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('marks API responses as non-cacheable', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('alice'));
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('Firebase UID → PostgreSQL user mapping', () => {
  it('provisions exactly one user per Firebase UID', async () => {
    const { app, users } = buildTestApp();
    const a = await request(app).get('/api/v1/me').set('Authorization', bearer('alice')).expect(200);
    const b = await request(app).get('/api/v1/me').set('Authorization', bearer('alice')).expect(200);
    expect(a.body.userId).toBe(userIdFor('alice'));
    expect(b.body.userId).toBe(a.body.userId);
    expect(users.rows).toHaveLength(1);
  });

  it('refuses to create a user without a verified email', async () => {
    const { app, users } = buildTestApp();
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('unverified-bob')).expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(users.rows).toHaveLength(0);
  });

  it('never creates a duplicate user for an email owned by another Firebase account', async () => {
    const { app, users } = buildTestApp();
    users.rows.push({ id: 'existing', firebaseUid: 'other-uid', email: 'carol@example.test', disabled: false });
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('carol')).expect(409);
    expect(res.body.error.code).toBe('ACCOUNT_LINK_REQUIRED');
    expect(users.rows).toHaveLength(1);
  });

  it('blocks disabled users', async () => {
    const { app, users } = buildTestApp();
    users.rows.push({ id: 'd1', firebaseUid: 'dave', email: 'dave@example.test', disabled: true });
    expect((await request(app).get('/api/v1/me').set('Authorization', bearer('dave')).expect(403)).body.error.code).toBe(
      'ACCOUNT_DISABLED',
    );
  });
});

describe('profiles: identity comes from the token only', () => {
  const profile = { displayName: 'Alice', searchRadiusKm: 3 };

  it('updates the profile of the token user', async () => {
    const { app } = buildTestApp();
    const res = await request(app).put('/api/v1/me/profile').set('Authorization', bearer('alice')).send(profile).expect(200);
    expect(res.body.userId).toBe(userIdFor('alice'));
    expect(res.body.profile.displayName).toBe('Alice');
  });

  it('rejects attempts to set identity or roles in the body', async () => {
    const { app, access } = buildTestApp();
    for (const extra of [{ userId: 'mallory' }, { firebaseUid: 'x' }, { platformRoles: ['staff'] }, { role: 'moderator' }]) {
      await request(app).put('/api/v1/me/profile').set('Authorization', bearer('bob')).send({ ...profile, ...extra }).expect(400);
    }
    expect(await access.getPlatformRoles(userIdFor('bob'))).toEqual([]);
  });

  it('reports server-controlled roles and memberships read-only', async () => {
    const { app, access } = buildTestApp();
    const id = userIdFor('carol');
    access.roles.set(id, ['staff']);
    access.memberships.push(
      { communityId: 'c1', userId: id, role: 'volunteer', status: 'active', grantedBy: 'mod', updatedAt: '2026-10-01T00:00:00Z' },
      { communityId: 'c2', userId: id, role: 'member', status: 'removed', grantedBy: null, updatedAt: '2026-10-01T00:00:00Z' },
    );
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('carol')).expect(200);
    expect(res.body.platformRoles).toEqual(['staff']);
    expect(res.body.memberships).toEqual([{ communityId: 'c1', role: 'volunteer' }]);
  });

  it('rejects unsupported search radius values', async () => {
    const { app } = buildTestApp();
    await request(app).put('/api/v1/me/profile').set('Authorization', bearer('dave')).send({ ...profile, searchRadiusKm: 51 }).expect(400);
  });
});
