import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { bearer, buildTestApp, userIdFor } from '../../test/fakes.js';
import type { RequestsService } from './requests.service.js';

const id = '11111111-1111-4111-8111-111111111111';
const dto = {
  id, listingId: id, ownerId: 'owner', requesterId: userIdFor('alice'), quantity: 1, message: '', status: 'pending' as const,
  pickupBy: null, conversationId: null, createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z',
};
function fixture() {
  const service: RequestsService = {
    create: vi.fn<RequestsService['create']>().mockResolvedValue({ status: 201, body: dto }),
    transition: vi.fn<RequestsService['transition']>().mockResolvedValue({ status: 200, body: dto }),
    get: vi.fn<RequestsService['get']>().mockResolvedValue(dto),
    list: vi.fn<RequestsService['list']>().mockResolvedValue({ items: [], nextCursor: null }),
  };
  return { service, ...buildTestApp({ requests: service }) };
}

describe('Engineer 2 HTTP boundaries', () => {
  it('requires authentication on request, chat and inbox routes', async () => {
    const { app, service } = fixture();
    for (const path of ['/requests/incoming', '/requests/outgoing', '/conversations', '/notifications']) {
      await request(app).get(`/api/v1${path}`).expect(401);
    }
    await request(app).post('/api/v1/requests').send({ listingId: id }).expect(401);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('uses the authenticated internal user id and applies input defaults', async () => {
    const { app, service } = fixture();
    const res = await request(app).post('/api/v1/requests').set('Authorization', bearer('alice'))
      .set('Idempotency-Key', 'create-key-1').send({ listingId: id, quantity: 1 }).expect(201);
    expect(service.create).toHaveBeenCalledWith(userIdFor('alice'), 'create-key-1', { listingId: id, quantity: 1, message: '' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rejects identity injection and invalid quantities before calling the service', async () => {
    const { app, service } = fixture();
    for (const extra of [{ requesterId: 'mallory' }, { ownerId: 'mallory' }, { quantity: 0 }, { quantity: 1.5 }, { quantity: 101 }]) {
      await request(app).post('/api/v1/requests').set('Authorization', bearer('alice'))
        .set('Idempotency-Key', 'create-key-1').send({ listingId: id, quantity: 1, ...extra }).expect(400);
    }
    expect(service.create).not.toHaveBeenCalled();
  });

  it('requires a valid key on both create and transition', async () => {
    const { app, service } = fixture();
    for (const key of [null, 'short', 'invalid key with spaces']) {
      const call = request(app).post('/api/v1/requests').set('Authorization', bearer('alice'));
      if (key) call.set('Idempotency-Key', key);
      await call.send({ listingId: id, quantity: 1 }).expect(400);
    }
    await request(app).post(`/api/v1/requests/${id}/transition`).set('Authorization', bearer('alice')).send({ to: 'approved' }).expect(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.transition).not.toHaveBeenCalled();
  });

  it('never exposes system expiration or actor overrides to clients', async () => {
    const { app, service } = fixture();
    for (const body of [{ to: 'expired' }, { to: 'pending' }, { to: 'approved', actor: 'system' }]) {
      await request(app).post(`/api/v1/requests/${id}/transition`).set('Authorization', bearer('alice'))
        .set('Idempotency-Key', 'transition-key-1').send(body).expect(400);
    }
    expect(service.transition).not.toHaveBeenCalled();
  });

  it('validates UUID paths and bounded pagination', async () => {
    const { app, service } = fixture();
    await request(app).get('/api/v1/requests/not-a-uuid').set('Authorization', bearer('alice')).expect(400);
    await request(app).get('/api/v1/requests/incoming?limit=999').set('Authorization', bearer('alice')).expect(400);
    await request(app).get('/api/v1/requests/incoming?limit=2&cursor=abc').set('Authorization', bearer('alice')).expect(200);
    expect(service.list).toHaveBeenCalledWith(userIdFor('alice'), 'incoming', { limit: 2, cursor: 'abc' });
    expect(service.get).not.toHaveBeenCalled();
  });
});
