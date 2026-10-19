import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './test/fakes.js';

const dist = mkdtempSync(path.join(tmpdir(), 'nh-web-'));
mkdirSync(path.join(dist, 'assets'));
writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>NeighbourHood</title>');
writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
writeFileSync(path.join(dist, 'sw.js'), 'self.addEventListener("fetch",()=>{})');
afterAll(() => rmSync(dist, { recursive: true, force: true }));

describe('built PWA serving', () => {
  const { app } = buildTestApp({ config: { webDistDir: dist } });

  it('serves client routes with the uncached app shell', async () => {
    const res = await request(app).get('/activity').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('caches hashed assets immutably and revalidates the service worker', async () => {
    expect((await request(app).get('/assets/index-abc123.js').expect(200)).headers['cache-control']).toContain('immutable');
    expect((await request(app).get('/sw.js').expect(200)).headers['cache-control']).toBe('no-cache');
  });

  it('returns 404 for a chunk removed by a newer release instead of HTML', async () => {
    const res = await request(app).get('/assets/LeafletSearchMap-old.js').expect(404);
    expect(res.headers['content-type']).not.toMatch(/text\/html/);
    await request(app).get('/icons/missing.png').expect(404);
  });

  it('allows the Firebase Google sign-in popup to talk to the app', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('never falls back to the app shell for API paths, and never caches them', async () => {
    const res = await request(app).get('/api/v1/unknown').expect(401);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
