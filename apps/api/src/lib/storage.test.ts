import { describe, expect, it } from 'vitest';
import type { Storage } from 'firebase-admin/storage';
import { FirebaseObjectStorage } from './storage.js';

describe('bucket photo grants', () => {
  it('binds each expiring read to its exact path and signature', async () => {
    const storage = new FirebaseObjectStorage({} as Storage, 'demo-bucket', Buffer.alloc(32, 1));
    const url = new URL(await storage.signedReadUrl('listings/item/photo.webp'), 'http://localhost');
    const expires = url.searchParams.get('expires')!, signature = url.searchParams.get('signature')!;
    expect(() => storage.verifyRead('listings/item/photo.webp', expires, signature)).not.toThrow();
    expect(() => storage.verifyRead('listings/other/photo.webp', expires, signature)).toThrow();
    expect(() => storage.verifyRead('listings/item/photo.webp', '1000000000000', signature)).toThrow();
    expect(() => storage.verifyRead('listings/item/photo.webp', expires, 'x')).toThrow();
  });
});
