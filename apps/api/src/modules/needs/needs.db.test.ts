import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { NeedsExtraction } from '@neighbourhood/shared';
import { createApp } from '../../app.js';
import { createDb } from '../../lib/db.js';
import { testDatabaseUrl } from '../../test/db-global-setup.js';
import { bearer, FakeVerifier, testConfig } from '../../test/fakes.js';
import { AiService } from '../ai/ai.service.js';
import { PrismaAccessRepository } from '../auth/access.js';
import { PrismaUsersRepository, UserProvisioningService } from '../auth/users.js';
import { PrismaConversationsService } from '../conversations/conversations.service.js';
import { EmailOtpService } from '../email-otp/otp.service.js';
import { PrismaNotificationsService } from '../notifications/notifications.service.js';
import { PrismaProfilesRepository } from '../profiles/profiles.repository.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { PrismaRequestsService } from '../requests/requests.service.js';
import { PrismaNeedsService } from './needs.service.js';

const db = createDb(testDatabaseUrl());
const access = new PrismaAccessRepository(db);
const app = createApp({
  config: testConfig(), tokenVerifier: new FakeVerifier(), users: new UserProvisioningService(new PrismaUsersRepository(db)),
  access, otp: new EmailOtpService(null, false), profiles: new ProfilesService(new PrismaProfilesRepository(db), access),
  ai: new AiService(null), requests: new PrismaRequestsService(db), conversations: new PrismaConversationsService(db),
  notifications: new PrismaNotificationsService(db), needs: new PrismaNeedsService(db),
});
const userIds: string[] = [];
const fixture = `saved-need-${randomUUID()}`;
const extraction: NeedsExtraction = {
  language: 'en',
  items: [{ name: 'Rice cooker', category: 'appliances', quantity: 1, preference: 'donation', attributes: [] }],
  timing: { neededBy: null, loanDurationDays: null, originalText: null },
  clarificationQuestions: [], outOfScope: [],
};

async function user() {
  const firebaseUid = `${fixture}-${randomUUID()}`;
  const row = await db.user.create({ data: { firebaseUid, email: `${firebaseUid}@example.test`, emailVerified: true } });
  userIds.push(row.id);
  return row;
}

afterAll(async () => {
  await db.need.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe('saved needs against PostgreSQL', () => {
  it('requires review input, replays a retry and keeps the need private', async () => {
    const alice = await user();
    const bob = await user();
    const key = randomUUID();
    const path = '/api/v1/needs';
    const save = () => request(app).post(path).set('Authorization', bearer(alice.firebaseUid))
      .set('Idempotency-Key', key).send({ extraction });
    const first = await save().expect(201);
    const replay = await save().expect(201);
    expect(replay.body).toEqual(first.body);
    expect(await db.need.count({ where: { userId: alice.id } })).toBe(1);
    const mine = await request(app).get(path).set('Authorization', bearer(alice.firebaseUid)).expect(200);
    expect(mine.body.items.map((need: { id: string }) => need.id)).toContain(first.body.id);
    const theirs = await request(app).get(path).set('Authorization', bearer(bob.firebaseUid)).expect(200);
    expect(theirs.body.items).toEqual([]);
    await request(app).delete(`${path}/${first.body.id}`).set('Authorization', bearer(bob.firebaseUid)).expect(404);
    await request(app).delete(`${path}/${first.body.id}`).set('Authorization', bearer(alice.firebaseUid)).expect(204);
    expect(await db.need.count({ where: { id: first.body.id } })).toBe(0);
  });

  it('rejects an empty extraction and a changed retry payload', async () => {
    const alice = await user();
    const path = '/api/v1/needs';
    const auth = bearer(alice.firebaseUid);
    await request(app).post(path).set('Authorization', auth).set('Idempotency-Key', randomUUID())
      .send({ extraction: { ...extraction, items: [] } }).expect(400);
    const key = randomUUID();
    await request(app).post(path).set('Authorization', auth).set('Idempotency-Key', key)
      .send({ extraction }).expect(201);
    await request(app).post(path).set('Authorization', auth).set('Idempotency-Key', key)
      .send({ extraction: { ...extraction, language: 'id' } }).expect(409);
  });
});
