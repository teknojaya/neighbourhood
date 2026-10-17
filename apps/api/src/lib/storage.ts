import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Storage } from 'firebase-admin/storage';
import { HttpError } from './http.js';

export interface ObjectStorage {
  signedReadUrl(path: string, ttlSeconds?: number): Promise<string>;
  put(path: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
}
export const SAFE_PATH = /^listings\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]{1,120}$/;

/** Bucket-backed in development and production. Uploads require authenticated
 * ownership and decoding. Read grants expire; reload detail to renew them.
 * Configure one shared signing secret for deployments with multiple instances.
 */
export class FirebaseObjectStorage implements ObjectStorage {
  constructor(private readonly storage: Storage, private readonly bucketName: string, private readonly secret: Buffer = randomBytes(32)) {}
  private signature(path: string, expires: string) { return createHmac('sha256', this.secret).update(`${path}\n${expires}`).digest('hex'); }
  async signedReadUrl(path: string, ttlSeconds = 900) {
    this.assertPath(path);
    const expires = String(Date.now() + Math.min(ttlSeconds, 900) * 1000);
    return `/api/v1/storage/file?path=${encodeURIComponent(path)}&expires=${expires}&signature=${this.signature(path, expires)}`;
  }
  verifyRead(path: string, expires: string, signature: string) {
    this.assertPath(path);
    if (!/^\d{13}$/.test(expires) || Number(expires) <= Date.now() || Number(expires) > Date.now() + 900_000 || !/^[a-f0-9]{64}$/.test(signature)
      || !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(this.signature(path, expires), 'hex'))) throw new HttpError('FORBIDDEN', 'Photo link has expired');
  }
  async put(path: string, bytes: Buffer, mimeType: string) {
    this.assertPath(path);
    await this.storage.bucket(this.bucketName).file(path).save(bytes, { resumable: false, metadata: { contentType: mimeType, cacheControl: 'private, no-store' } });
  }
  async get(path: string) { this.assertPath(path); return (await this.storage.bucket(this.bucketName).file(path).download())[0]; }
  async remove(path: string) { this.assertPath(path); await this.storage.bucket(this.bucketName).file(path).delete({ ignoreNotFound: true }); }
  async *candidates() { for await (const file of this.storage.bucket(this.bucketName).getFilesStream({ prefix: 'listings/' })) if (file.metadata.timeCreated) yield { path: file.name as string, createdAt: new Date(file.metadata.timeCreated) }; }
  private assertPath(path: string) { if (!SAFE_PATH.test(path)) throw new HttpError('VALIDATION_FAILED', 'Invalid photo path'); }
}
