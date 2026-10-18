import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Storage } from 'firebase-admin/storage';
import { describe, expect, it } from 'vitest';
import { testConfig } from '../test/fakes.js';
import { createStorageBundle } from './storage-bundle.js';

describe('integrated storage selection', () => {
  it('keeps an emulator bucket authoritative and refuses silent fallback or deployed disk mode', async () => {
    const storage = { bucket: () => ({ file: () => ({ download: async () => { throw new Error('bucket unavailable'); } }) }) } as unknown as Storage;
    const config = testConfig({ firebase: { projectId: 'demo-neighbourhood', storageBucket: 'test-bucket', useEmulators: true } });
    const bundle = createStorageBundle(config, storage, {});
    expect(bundle.driver).toBe('firebase');
    await expect(bundle.photos.get('listings/item/photo.webp')).rejects.toThrow('bucket unavailable');
    expect(() => createStorageBundle({ ...config, env: 'production' }, storage, { STORAGE_DRIVER: 'local' })).toThrow();
    expect(() => createStorageBundle({ ...config, deployed: true }, storage, { STORAGE_DRIVER: 'local' })).toThrow();
    expect(() => createStorageBundle(config, storage, { STORAGE_DRIVER: 'typo' })).toThrow();
  });

  it('uses one local root while isolating public, AI and conversation images and cleanup candidates', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'neighbourhood-storage-'));
    try {
      const bundle = createStorageBundle(testConfig(), {} as Storage, { STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: root });
      const photo = 'listings/item/photo.webp', ask = 'ask-attachments/session/photo', conversation = 'conversation-attachments/thread/photo.webp';
      await bundle.photos.put(photo, Buffer.from('public'), 'image/webp');
      await bundle.ask.write(ask, Buffer.from('private AI'), 'image/webp');
      await bundle.conversations.write(conversation, Buffer.from('private neighbour'), 'image/webp');
      const reloaded = createStorageBundle(testConfig(), {} as Storage, { STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: root });
      expect((await reloaded.ask.read(ask)).toString()).toBe('private AI');
      expect((await reloaded.conversations.read(conversation)).toString()).toBe('private neighbour');
      await expect(bundle.photos.signedReadUrl(ask)).rejects.toThrow();
      await expect(bundle.ask.read(conversation)).rejects.toThrow();
      await expect(bundle.conversations.write('conversation-attachments/thread/../../escape', Buffer.from('x'), 'image/webp')).rejects.toThrow();
      const collect = async (source: AsyncIterable<{ path: string }>) => { const paths = []; for await (const file of source) paths.push(file.path); return paths; };
      expect(await collect(bundle.photos.candidates())).toEqual([photo]);
      expect(await collect(bundle.ask.candidates())).toEqual([ask]);
      expect(await collect(bundle.conversations.candidates())).toEqual([conversation]);
      await bundle.ask.delete(ask); await bundle.conversations.delete(conversation); await bundle.photos.remove(photo);
      expect(await collect(bundle.ask.candidates())).toEqual([]);
      expect(await collect(bundle.conversations.candidates())).toEqual([]);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});
