import type { Storage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { AI_LIMITS } from '@neighbourhood/shared';
import { HttpError } from '../../lib/http.js';

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

/** Files are accessed only through authenticated Ask routes, never public URLs. */
export class FirebaseAskImageStorage implements AskImageStorage {
  constructor(private readonly storage: Storage, private readonly bucket: string, private readonly prefix = 'ask-attachments/') {}
  async write(path: string, bytes: Buffer, mimeType: string) {
    await this.storage.bucket(this.bucket).file(path).save(bytes, { resumable: false, metadata: { contentType: mimeType, cacheControl: 'private, no-store' } });
  }
  async read(path: string) {
    const [bytes] = await this.storage.bucket(this.bucket).file(path).download();
    return bytes;
  }
  async delete(path: string) { await this.storage.bucket(this.bucket).file(path).delete({ ignoreNotFound: true }); }
  async *candidates() {
    for await (const file of this.storage.bucket(this.bucket).getFilesStream({ prefix: this.prefix })) {
      if (file.metadata.timeCreated) yield { path: file.name as string, createdAt: new Date(file.metadata.timeCreated) };
    }
  }
}
