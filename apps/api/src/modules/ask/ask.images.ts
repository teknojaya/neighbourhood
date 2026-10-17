import fs from 'node:fs/promises';
import path from 'node:path';
import type { Storage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { AI_LIMITS } from '@neighbourhood/shared';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';

export interface AskImageStorage {
  write(path: string, bytes: Buffer, mimeType: string): Promise<void>;
  read(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  candidates?(): AsyncIterable<{ path: string; createdAt: Date }>;
}

export function validateImage(bytes: Buffer, mimeType: string) {
  if (bytes.length === 0 || bytes.length > AI_LIMITS.imageMaxBytes) throw new HttpError('PAYLOAD_TOO_LARGE', 'Images must be at most 4 MB');
  const detected = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'image/jpeg'
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
  if (!detected || detected !== mimeType) throw new HttpError('VALIDATION_FAILED', 'Use a JPEG, PNG or WebP image matching its content type');
}

/** Decode, limit pixels, orient and re-encode. Metadata (including EXIF GPS) is stripped. */
export async function normalizeImage(bytes: Buffer, mimeType: string) {
  validateImage(bytes, mimeType);
  try {
    const result = await sharp(bytes, { limitInputPixels: 25_000_000, failOn: 'warning' })
      .rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    validateImage(result, 'image/webp');
    return result;
  } catch {
    throw new HttpError('VALIDATION_FAILED', 'This image cannot be read. Use a photo under 25 megapixels.');
  }
}

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

export class LocalAskImageStorage implements AskImageStorage {
  constructor(private readonly baseDir: string = path.resolve('uploads/ask-attachments')) {}

  private resolvePath(targetPath: string): string {
    const resolved = path.resolve(this.baseDir, targetPath);
    const relative = path.relative(this.baseDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new HttpError('FORBIDDEN', 'Path traversal prohibited');
    }
    return resolved;
  }

  async write(targetPath: string, bytes: Buffer, _mimeType: string): Promise<void> {
    const full = this.resolvePath(targetPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
  }

  async read(targetPath: string): Promise<Buffer> {
    const full = this.resolvePath(targetPath);
    try {
      return await fs.readFile(full);
    } catch {
      throw new HttpError('NOT_FOUND', 'Attachment not found');
    }
  }

  async delete(targetPath: string): Promise<void> {
    const full = this.resolvePath(targetPath);
    try {
      await fs.unlink(full);
    } catch {}
  }

  async *candidates(): AsyncIterable<{ path: string; createdAt: Date }> {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const parentDir = entry.parentPath || (entry as unknown as { path: string }).path || this.baseDir;
          const fullPath = path.join(parentDir, entry.name);
          const rel = path.relative(this.baseDir, fullPath).replace(/\\/g, '/');
          const stat = await fs.stat(fullPath);
          yield { path: rel, createdAt: stat.birthtime };
        }
      }
    } catch {}
  }
}

/** Files are accessed only through authenticated Ask routes, never public URLs. */
export class FirebaseAskImageStorage implements AskImageStorage {
  constructor(
    private readonly storage: Storage,
    private readonly bucket: string,
    private readonly fallback?: AskImageStorage,
  ) {}

  async write(pathStr: string, bytes: Buffer, mimeType: string) {
    try {
      await this.storage
        .bucket(this.bucket)
        .file(pathStr)
        .save(bytes, { resumable: false, metadata: { contentType: mimeType, cacheControl: 'private, no-store' } });
    } catch (err: unknown) {
      if (this.fallback && isBucketMissingError(err)) {
        logger.warn('gcs_ask_bucket_missing_fallback_local', { bucket: this.bucket, path: pathStr });
        return await this.fallback.write(pathStr, bytes, mimeType);
      }
      throw err;
    }
  }

  async read(pathStr: string) {
    try {
      const [bytes] = await this.storage.bucket(this.bucket).file(pathStr).download();
      return bytes;
    } catch (err: unknown) {
      if (this.fallback && isBucketMissingError(err)) {
        return await this.fallback.read(pathStr);
      }
      throw err;
    }
  }

  async delete(pathStr: string) {
    try {
      await this.storage.bucket(this.bucket).file(pathStr).delete({ ignoreNotFound: true });
    } catch (err: unknown) {
      if (this.fallback && isBucketMissingError(err)) {
        return await this.fallback.delete(pathStr);
      }
      throw err;
    }
  }

  async *candidates() {
    try {
      for await (const file of this.storage.bucket(this.bucket).getFilesStream({ prefix: 'ask-attachments/' })) {
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
