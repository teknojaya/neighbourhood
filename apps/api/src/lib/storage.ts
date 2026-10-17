import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Storage } from 'firebase-admin/storage';
import { HttpError } from './http.js';
import { logger } from './logger.js';

export interface ObjectStorage {
  signedReadUrl(path: string, ttlSeconds?: number): Promise<string>;
  put(path: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
  candidates?(): AsyncIterable<{ path: string; createdAt: Date }>;
}

export interface VerifiableObjectStorage extends ObjectStorage {
  verifyRead(path: string, expires: string, signature: string): void;
}

export const SAFE_PATH = /^listings\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]{1,120}$/;

function isBucketMissingError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error).message || '';
  const code = (err as { code?: number | string }).code;
  return (
    code === 404 ||
    code === 'ENOENT' ||
    msg.includes('The specified bucket does not exist') ||
    msg.includes('bucket does not exist') ||
    msg.includes('ENOTFOUND')
  );
}

export abstract class BaseVerifiableStorage implements VerifiableObjectStorage {
  constructor(protected readonly secret: Buffer = randomBytes(32)) {}

  protected signature(pathStr: string, expires: string) {
    return createHmac('sha256', this.secret).update(`${pathStr}\n${expires}`).digest('hex');
  }

  async signedReadUrl(pathStr: string, ttlSeconds = 900) {
    this.assertPath(pathStr);
    const expires = String(Date.now() + Math.min(ttlSeconds, 900) * 1000);
    return `/api/v1/storage/file?path=${encodeURIComponent(pathStr)}&expires=${expires}&signature=${this.signature(pathStr, expires)}`;
  }

  verifyRead(pathStr: string, expires: string, signature: string) {
    this.assertPath(pathStr);
    if (
      !/^\d{13}$/.test(expires) ||
      Number(expires) <= Date.now() ||
      Number(expires) > Date.now() + 900_000 ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(this.signature(pathStr, expires), 'hex'))
    ) {
      throw new HttpError('FORBIDDEN', 'Photo link has expired');
    }
  }

  protected assertPath(pathStr: string) {
    if (!SAFE_PATH.test(pathStr)) throw new HttpError('VALIDATION_FAILED', 'Invalid photo path');
  }

  abstract put(pathStr: string, bytes: Buffer, mimeType: string): Promise<void>;
  abstract get(pathStr: string): Promise<Buffer>;
  abstract remove(pathStr: string): Promise<void>;
  abstract candidates?(): AsyncIterable<{ path: string; createdAt: Date }>;
}

/**
 * Local filesystem-backed object storage for development and emulator environments.
 * Stores binary files in local directory with HMAC-signed read URLs.
 */
export class LocalFileObjectStorage extends BaseVerifiableStorage {
  constructor(private readonly baseDir: string = path.resolve('uploads'), secret?: Buffer) {
    super(secret);
  }

  private resolvePath(targetPath: string): string {
    this.assertPath(targetPath);
    const resolved = path.resolve(this.baseDir, targetPath);
    const relative = path.relative(this.baseDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new HttpError('FORBIDDEN', 'Path traversal prohibited');
    }
    return resolved;
  }

  async put(targetPath: string, bytes: Buffer, _mimeType: string): Promise<void> {
    const fullPath = this.resolvePath(targetPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, bytes);
  }

  async get(targetPath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(targetPath);
    try {
      return await fs.readFile(fullPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new HttpError('NOT_FOUND', 'Photo not found');
      }
      throw err;
    }
  }

  async remove(targetPath: string): Promise<void> {
    const fullPath = this.resolvePath(targetPath);
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async *candidates(): AsyncIterable<{ path: string; createdAt: Date }> {
    const listingsDir = path.resolve(this.baseDir, 'listings');
    try {
      const entries = await fs.readdir(listingsDir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const parentDir = entry.parentPath || (entry as unknown as { path: string }).path || listingsDir;
          const fullPath = path.join(parentDir, entry.name);
          const rel = path.relative(this.baseDir, fullPath).replace(/\\/g, '/');
          const stat = await fs.stat(fullPath);
          yield { path: rel, createdAt: stat.birthtime };
        }
      }
    } catch {
      // Base directory or listings directory does not exist yet
    }
  }
}

/**
 * Bucket-backed in development and production. Uploads require authenticated
 * ownership and decoding. Read grants expire; reload detail to renew them.
 * Configure one shared signing secret for deployments with multiple instances.
 * Automatically falls back to local storage if cloud bucket does not exist.
 */
export class FirebaseObjectStorage extends BaseVerifiableStorage {
  constructor(
    private readonly storage: Storage,
    private readonly bucketName: string,
    secret?: Buffer,
    private readonly fallback?: ObjectStorage,
  ) {
    super(secret);
  }

  async put(pathStr: string, bytes: Buffer, mimeType: string): Promise<void> {
    this.assertPath(pathStr);
    try {
      await this.storage
        .bucket(this.bucketName)
        .file(pathStr)
        .save(bytes, { resumable: false, metadata: { contentType: mimeType, cacheControl: 'private, no-store' } });
    } catch (err: unknown) {
      if (this.fallback && isBucketMissingError(err)) {
        logger.warn('gcs_bucket_missing_fallback_local', { bucket: this.bucketName, path: pathStr });
        return await this.fallback.put(pathStr, bytes, mimeType);
      }
      throw err;
    }
  }

  async get(pathStr: string): Promise<Buffer> {
    this.assertPath(pathStr);
    try {
      return (await this.storage.bucket(this.bucketName).file(pathStr).download())[0];
    } catch (err: unknown) {
      if (this.fallback && isBucketMissingError(err)) {
        return await this.fallback.get(pathStr);
      }
      throw err;
    }
  }

  async remove(pathStr: string): Promise<void> {
    this.assertPath(pathStr);
    try {
      await this.storage.bucket(this.bucketName).file(pathStr).delete({ ignoreNotFound: true });
    } catch (err: unknown) {
      if (this.fallback && isBucketMissingError(err)) {
        return await this.fallback.remove(pathStr);
      }
      throw err;
    }
  }

  async *candidates(): AsyncIterable<{ path: string; createdAt: Date }> {
    try {
      for await (const file of this.storage.bucket(this.bucketName).getFilesStream({ prefix: 'listings/' })) {
        if (file.metadata.timeCreated) yield { path: file.name as string, createdAt: new Date(file.metadata.timeCreated) };
      }
    } catch (err: unknown) {
      if (this.fallback && isBucketMissingError(err) && this.fallback.candidates) {
        yield* this.fallback.candidates();
      } else {
        throw err;
      }
    }
  }
}

