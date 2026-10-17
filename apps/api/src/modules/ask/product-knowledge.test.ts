import { describe, expect, it } from 'vitest';
import { ITEM_CATEGORIES, RADIUS_OPTIONS_KM } from '@neighbourhood/shared';
import { PRODUCT_GUIDE, PRODUCT_ORIENTATION } from './product-knowledge.js';
import { ASK_SYSTEM } from './ask.model.js';

describe('grounded product knowledge', () => {
  it('keeps the screenshot’s neighbour/member confusion out of the base orientation', () => {
    expect(ASK_SYSTEM).toContain(PRODUCT_ORIENTATION);
    expect(PRODUCT_GUIDE.roles.neighbour).toContain('may have no community memberships');
    expect(PRODUCT_GUIDE.roles.member).toContain('pending');
    expect(PRODUCT_GUIDE.roles.staff).toContain('does not automatically');
  });
  it('uses actual categories and supported search radii', () => {
    expect(PRODUCT_GUIDE.overview.categories).toEqual(ITEM_CATEGORIES);
    expect(PRODUCT_GUIDE.location.radiusKm).toEqual(RADIUS_OPTIONS_KM);
  });
});
