import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';

/** Fixtures use the same private draft -> photo -> activation flow as residents. */
export async function publishPhotoFixture(base, who, listing, asset = 'picture-books') {
  const headers = { Authorization: 'Bearer ' + who.token, 'Idempotency-Key': randomUUID(), 'Content-Type': 'image/jpeg' };
  const photo = await fetch(new URL(`/api/v1/listings/${listing.id}/photos`, base), { method: 'POST', headers, body: await readFile(`apps/api/seed-assets/products/${asset}.jpg`) });
  assert(photo.ok, `Fixture photo: HTTP ${photo.status}`);
  const active = await fetch(new URL(`/api/v1/listings/${listing.id}/transition`, base), { method: 'POST', headers: { ...headers, 'Idempotency-Key': randomUUID(), 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'active' }) });
  assert(active.ok, `Fixture publication: HTTP ${active.status}`);
  return active.json();
}
export async function removePhotoFixtures(app, db, ids) {
  const bucket = getStorage(app).bucket(process.env.FIREBASE_STORAGE_BUCKET);
  for (const photo of await db.listingPhoto.findMany({ where: { listing: { ownerId: { in: ids } } } })) await bucket.file(photo.storagePath).delete({ ignoreNotFound: true });
}
