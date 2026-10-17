import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeImage } from './ask.images.js';

describe('private Ask image processing', () => {
  it('decodes and strips metadata while bounding the output dimensions', async () => {
    const photo = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: 'red' } })
      .withExif({ IFD0: { Copyright: 'PRIVATE_METADATA' } }).jpeg().toBuffer();
    const result = await normalizeImage(photo, 'image/jpeg');
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
    expect(metadata.exif).toBeUndefined();
    expect(result.includes(Buffer.from('PRIVATE_METADATA'))).toBe(false);
  });

  it('rejects a forged image header, MIME mismatch and an oversized input', async () => {
    await expect(normalizeImage(Buffer.from([255, 216, 255, 0, 0]), 'image/jpeg')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const photo = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer();
    await expect(normalizeImage(photo, 'image/jpeg')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(normalizeImage(Buffer.alloc(4 * 1024 * 1024 + 1), 'image/png')).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('rejects images whose decoded dimensions exceed the pixel budget', async () => {
    const photo = await sharp({ create: { width: 5100, height: 5000, channels: 3, background: 'white' } }).png().toBuffer();
    await expect(normalizeImage(photo, 'image/png')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
