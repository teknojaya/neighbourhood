/**
 * Generates PWA PNG icons without native dependencies (house + heart mark,
 * matching apps/web/public/icons/icon.svg). Usage:
 *   node scripts/generate-icons.mjs apps/web/public/icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const outDir = process.argv[2] ?? 'apps/web/public/icons';
mkdirSync(outDir, { recursive: true });

const TEAL = [15, 118, 110];
const WHITE = [255, 255, 255];
const AMBER = [245, 158, 11];

const house = [[12, 32], [32, 15], [52, 32], [46, 32], [46, 49], [18, 49], [18, 32]];
const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inHeart = (x, y) => {
  // Implicit heart curve centred at (32, 38), ~9 units wide.
  const u = (x - 32) / 9;
  const v = -(y - 39) / 9;
  return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0;
};
const inRoundedRect = (x, y, r) => {
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/** Returns RGBA for a point in 64-unit design space. `maskable` = full-bleed bg, shrunk mark. */
function shade(x, y, maskable) {
  if (maskable) {
    // Keep the mark inside the 80% safe zone.
    const s = 0.72;
    const mx = (x - 32) / s + 32;
    const my = (y - 32) / s + 32;
    if (inHeart(mx, my)) return [...AMBER, 255];
    if (inPoly(mx, my, house)) return [...WHITE, 255];
    return [...TEAL, 255];
  }
  if (!inRoundedRect(x, y, 14)) return [0, 0, 0, 0];
  if (inHeart(x, y)) return [...AMBER, 255];
  if (inPoly(x, y, house)) return [...WHITE, 255];
  return [...TEAL, 255];
}

function render(size, maskable) {
  const ss = 4; // supersampling for anti-aliasing
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = shade(((px + (sx + 0.5) / ss) / size) * 64, ((py + (sy + 0.5) / ss) / size) * 64, maskable);
          acc[0] += c[0] * c[3];
          acc[1] += c[1] * c[3];
          acc[2] += c[2] * c[3];
          acc[3] += c[3];
        }
      const a = acc[3] / (ss * ss);
      const o = 1 + px * 4;
      row[o] = a ? Math.round(acc[0] / acc[3]) : 0;
      row[o + 1] = a ? Math.round(acc[1] / acc[3]) : 0;
      row[o + 2] = a ? Math.round(acc[2] / acc[3]) : 0;
      row[o + 3] = Math.round(a);
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon-180.png', 180, true],
]) {
  writeFileSync(join(outDir, name), render(size, maskable));
  console.warn(`wrote ${join(outDir, name)}`);
}
