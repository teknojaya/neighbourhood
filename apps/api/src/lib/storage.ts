import { AI_LIMITS } from '@neighbourhood/shared';
import type { Storage } from 'firebase-admin/storage';

export interface ObjectStorage {
  /** Short-lived URL for displaying a stored image. */
  signedReadUrl(path: string, ttlSeconds?: number): Promise<string>;
  /** Short-lived PUT URL restricted to one content type and a size range. */
  signedUploadUrl(path: string, contentType: string, ttlSeconds?: number): Promise<string>;
}

const SAFE_PATH = /^(uploads|listings)\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]{1,120}$/;

/**
 * Cloud Storage for Firebase (images). Clients never get bucket access:
 * the API issues V4 signed URLs. Requires a credential that can sign
 * (service account key or iam.serviceAccounts.signBlob on Cloud Run).
 */
export class FirebaseObjectStorage implements ObjectStorage {
  constructor(
    private readonly storage: Storage,
    private readonly bucketName: string,
  ) {}

  async signedReadUrl(path: string, ttlSeconds = 15 * 60) {
    this.assertPath(path);
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(path)
      .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + ttlSeconds * 1000 });
    return url;
  }

  async signedUploadUrl(path: string, contentType: string, ttlSeconds = 10 * 60) {
    this.assertPath(path);
    if (!(AI_LIMITS.imageMimeTypes as readonly string[]).includes(contentType)) throw new Error('Unsupported image type');
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(path)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        contentType,
        expires: Date.now() + ttlSeconds * 1000,
        extensionHeaders: { 'x-goog-content-length-range': `1,${AI_LIMITS.imageMaxBytes}` },
      });
    return url;
  }

  private assertPath(path: string) {
    if (!SAFE_PATH.test(path)) throw new Error('Invalid storage path');
  }
}
