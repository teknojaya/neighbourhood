import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { Storage } from 'firebase-admin/storage';
import { FirebaseObjectStorage, LocalFileObjectStorage } from './storage.js';

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

describe('LocalFileObjectStorage', () => {
  it('stores, retrieves, and removes files safely', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    try {
      const storage = new LocalFileObjectStorage(tempDir, Buffer.alloc(32, 2));
      const testPath = 'listings/test-listing/photo1.webp';
      const testBytes = Buffer.from('fake-webp-bytes');

      // Put
      await storage.put(testPath, testBytes, 'image/webp');

      // Get
      const retrieved = await storage.get(testPath);
      expect(retrieved.equals(testBytes)).toBe(true);

      // Signed read URL
      const url = new URL(await storage.signedReadUrl(testPath), 'http://localhost');
      const expires = url.searchParams.get('expires')!;
      const signature = url.searchParams.get('signature')!;
      expect(() => storage.verifyRead(testPath, expires, signature)).not.toThrow();

      // Remove
      await storage.remove(testPath);
      await expect(storage.get(testPath)).rejects.toThrow();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects invalid or traversal paths', async () => {
    const storage = new LocalFileObjectStorage('/tmp', Buffer.alloc(32, 2));
    await expect(storage.put('../evil.webp', Buffer.from('x'), 'image/webp')).rejects.toThrow();
    await expect(storage.get('invalid-path')).rejects.toThrow();
  });
});

describe('FirebaseObjectStorage fallback', () => {
  it('falls back to local storage when cloud bucket does not exist', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-fallback-test-'));
    try {
      const local = new LocalFileObjectStorage(tempDir, Buffer.alloc(32, 3));
      const mockStorage = {
        bucket: () => ({
          file: () => ({
            save: async () => {
              throw new Error('The specified bucket does not exist.');
            },
            download: async () => {
              throw new Error('The specified bucket does not exist.');
            },
            delete: async () => {
              throw new Error('The specified bucket does not exist.');
            },
          }),
        }),
      } as unknown as Storage;

      const firebaseWithFallback = new FirebaseObjectStorage(mockStorage, 'non-existent-bucket', Buffer.alloc(32, 3), local);
      const testPath = 'listings/item123/img.webp';
      const testBytes = Buffer.from('image-data');

      // Should seamlessly fall back to local on put
      await firebaseWithFallback.put(testPath, testBytes, 'image/webp');

      // Should seamlessly fall back to local on get
      const result = await firebaseWithFallback.get(testPath);
      expect(result.equals(testBytes)).toBe(true);

      // Should seamlessly fall back to local on remove
      await firebaseWithFallback.remove(testPath);
      await expect(firebaseWithFallback.get(testPath)).rejects.toThrow();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
