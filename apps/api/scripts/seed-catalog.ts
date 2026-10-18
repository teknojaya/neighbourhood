import { createHash } from 'node:crypto';
import type { ItemCategory } from '@neighbourhood/shared';

export const seedId = (key: string) => {
  const hex = createHash('sha256').update('neighbourhood-playground-v1:' + key).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
export type SeedProduct = { key: string; title: string; category: ItemCategory; mode: 'donate' | 'lend'; photo: string; km: number; owner: 'owner' | 'neighbour' | 'volunteer'; quantity: number; description: string; bestBeforeDays?: number };
// A photo describes one product/bundle, never a category-wide fallback.
// Stable semantic keys are independent of array order, target account and scenario.
export const seedCatalog: SeedProduct[] = [
  { key: 'rice-sack', title: 'Sack of white rice 5kg', category: 'groceries', mode: 'donate', photo: 'sack-of-rice', km: 0.6, owner: 'owner', quantity: 12, bestBeforeDays: 90, description: 'Unopened 5kg sacks of white rice from a neighbourhood pantry surplus. Check the packaging and best-before label when collecting.' },
  { key: 'paracetamol', title: 'Paracetamol tablets 500mg', category: 'household', mode: 'donate', photo: 'paracetamol-tablets', km: 0.8, owner: 'neighbour', quantity: 12, bestBeforeDays: 180, description: 'Sample listing: sealed, labelled paracetamol 500mg blister packs in their original packaging. Check the expiry and packaging in person; the photo is sample content.' },
  { key: 'nasi-goreng', title: 'Surplus Nasi Goreng portions', category: 'groceries', mode: 'donate', photo: 'nasi-goreng', km: 1, owner: 'owner', quantity: 8, bestBeforeDays: 0, description: 'Extra portions of Nasi Goreng with egg and crackers from neighbourhood catering. Same-day collection only. Contains egg, soy and wheat; confirm ingredients and storage with the neighbour.' },
  { key: 'cobek', title: 'Stone mortar, pestle and cooking spatula', category: 'household', mode: 'donate', photo: 'cobek-mortar', km: 1.1, owner: 'neighbour', quantity: 12, description: 'A volcanic stone cobek and pestle with a wooden cooking spatula for a neighbour setting up their kitchen.' },
  { key: 'groceries', title: 'Rice, instant noodles and cooking oil bundle', category: 'groceries', mode: 'donate', photo: 'indonesian-groceries', km: 1.3, owner: 'owner', quantity: 12, bestBeforeDays: 90, description: 'A sealed pantry bundle of rice, instant noodles and cooking oil. One bundle per request; check each package label on collection.' },
  { key: 'condiments', title: 'Soy sauce, sambal and biscuit pantry bundle', category: 'groceries', mode: 'donate', photo: 'kitchen-condiments', km: 1.5, owner: 'neighbour', quantity: 12, bestBeforeDays: 60, description: 'Unopened sweet soy sauce, sambal, biscuit tin and seasonings shared together as one pantry bundle. Check ingredient and allergen labels.' },
  { key: 'books', title: 'Illustrated animal picture books', category: 'books', mode: 'donate', photo: 'picture-books', km: 0.5, owner: 'neighbour', quantity: 12, description: 'A set of illustrated animal picture books for a new reader. Shared as one set.' },
  { key: 'clothing', title: 'Cotton jackets and scarf bundle', category: 'clothing', mode: 'donate', photo: 'cotton-clothing-hanging', km: 1.8, owner: 'neighbour', quantity: 12, description: 'Clean olive and cream cotton jackets with a matching scarf, shared together as one bundle. Ask the owner about sizes.' },
  { key: 'tableware', title: 'Ceramic dinner plates and bowls set', category: 'household', mode: 'donate', photo: 'tableware', km: 2.2, owner: 'neighbour', quantity: 12, description: 'An ivory ceramic dinner set with plates and bowls for a neighbour moving home. One set per request.' },
  { key: 'first-aid', title: 'Household first-aid and care bundle', category: 'household', mode: 'donate', photo: 'household-medicine', km: 2.4, owner: 'owner', quantity: 12, bestBeforeDays: 180, description: 'Sample household care bundle with sealed gauze, a thermometer, labelled cajuput oil and a tablet blister. Inspect contents and expiry labels in person.' },
  { key: 'cleaning', title: 'Broom, dustpan and hot-water thermos set', category: 'household', mode: 'lend', photo: 'cleaning-supplies', km: 2.5, owner: 'owner', quantity: 1, description: 'Borrow the pictured broom, dustpan and stainless thermos together for a neighbourhood gathering. Return the complete set clean.' },
  { key: 'wheelchair', title: 'Folding wheelchair', category: 'mobility_aids', mode: 'lend', photo: 'folding-wheelchair', km: 2.7, owner: 'neighbour', quantity: 1, description: 'A folding wheelchair with footrests available for temporary borrowing. Review fit and condition with the owner before use.' },
  { key: 'rice-cooker', title: 'Electric rice cooker', category: 'appliances', mode: 'lend', photo: 'rice-cooker', km: 2.6, owner: 'owner', quantity: 1, description: 'An electric rice cooker for a family meal or neighbourhood event. Confirm working condition and return all parts clean.' },
  { key: 'walking-aid', title: 'Aluminium walking frame', category: 'mobility_aids', mode: 'lend', photo: 'walking-aid', km: 2.8, owner: 'neighbour', quantity: 1, description: 'An aluminium walking frame for temporary borrowing. Review height and condition with the owner before use.' },
  { key: 'tools', title: 'Cordless drill and household tool kit', category: 'household', mode: 'lend', photo: 'tool-kit', km: 4.5, owner: 'owner', quantity: 1, description: 'Borrow the cordless drill and pictured hand-tool case for small home repairs. Return all tools and bits together.' },
  { key: 'pantry', title: 'Sealed rice, beans and lentils pantry parcels', category: 'groceries', mode: 'donate', photo: 'pantry-staples', km: 0.7, owner: 'volunteer', quantity: 20, bestBeforeDays: 60, description: 'Sealed rice, beans and lentils available together from the neighbourhood sharing pantry. Collect during opening hours after approval.' },
  { key: 'community-meals', title: 'Community boxed rice meals', category: 'groceries', mode: 'donate', photo: 'community-rice-meals', km: 0.7, owner: 'volunteer', quantity: 12, bestBeforeDays: 0, description: 'Boxed rice meals with vegetables and sides, shared through the community pantry. Same-day collection during opening hours after approval. Confirm ingredients, allergens and storage with the volunteer; the supplied photo illustrates this meal batch.' },
];
export const catalogListingId = (key: string) => seedId('catalog-v2:' + key);

export function validateSeedCatalog(catalog = seedCatalog) {
  for (const field of ['key', 'photo', 'title'] as const) {
    if (new Set(catalog.map(item => item[field])).size !== catalog.length) throw new Error(`Duplicate seed product ${field}`);
  }
}

export function legacySeedIds(userIds: string[], scenarios: string[] = []) {
  const namespaces = ['default', ...userIds].flatMap(value => [value, ...scenarios.map(scenario => value + ':' + scenario)]);
  const listings = new Set<string>(), requests = new Set<string>(), loans = new Set<string>();
  for (let index = 0; index < 100; index++) listings.add(seedId('catalog:' + index));
  for (const namespace of namespaces) {
    for (let index = 0; index < 100; index++) listings.add(seedId(namespace + ':listing:catalog:' + index));
    listings.add(seedId(seedId(namespace + ':pantry-stock') + ':listing'));
    for (const userId of userIds) {
      for (const status of ['pending', 'approved', 'collected', 'rejected', 'cancelled', 'expired']) for (const incoming of [false, true]) {
        listings.add(seedId(`${namespace}:listing:${userId}:request:${incoming}:${status}`));
        requests.add(seedId(`${namespace}:${userId}:request:${incoming}:${status}`));
      }
      for (const status of ['pending', 'approved', 'checked_out', 'returned', 'rejected', 'cancelled']) {
        listings.add(seedId(`${namespace}:listing:${userId}:loan:${status}`));
        loans.add(seedId(`${namespace}:${userId}:loan:${status}`));
      }
    }
  }
  return { listings, requests, loans };
}

