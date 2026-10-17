import type { ItemCategory } from '@neighbourhood/shared';
const generic: Record<string, ItemCategory> = { clothes: 'clothing', clothing: 'clothing', apparel: 'clothing', pakaian: 'clothing', baju: 'clothing', books: 'books', book: 'books', buku: 'books', groceries: 'groceries', food: 'groceries', makanan: 'groceries', 'bahan makanan': 'groceries', appliances: 'appliances', appliance: 'appliances', household: 'household', 'household items': 'household', 'mobility aids': 'mobility_aids', 'alat bantu mobilitas': 'mobility_aids' };
/** Generic category words describe a category, not a literal product title. */
export function normalizeListingSearch(input: { query?: string; category?: ItemCategory }) {
  const category = generic[input.query?.trim().toLowerCase() ?? ''];
  return category && (!input.category || input.category === category) ? { query: undefined, category } : input;
}
