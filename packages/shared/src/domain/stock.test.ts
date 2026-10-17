import { describe, expect, it } from 'vitest';
import { availableUnits, collectStock, releaseStock, reserveStock, setTotalStock } from './stock.js';

const base = { total: 3, reserved: 0, collected: 0 };

describe('stock accounting', () => {
  it('reserves on approval and reduces availability', () => {
    const s = reserveStock(base, 2);
    expect(s).toEqual({ total: 3, reserved: 2, collected: 0 });
    expect(availableUnits(s)).toBe(1);
  });
  it('refuses to over-reserve', () => {
    expect(() => reserveStock({ total: 3, reserved: 2, collected: 1 }, 1)).toThrow(/Not enough/);
  });
  it('releases on cancellation/expiry', () => {
    expect(releaseStock({ total: 3, reserved: 2, collected: 0 }, 2)).toEqual(base);
    expect(() => releaseStock(base, 1)).toThrow();
  });
  it('moves reserved units to collected', () => {
    expect(collectStock({ total: 3, reserved: 2, collected: 0 }, 2)).toEqual({ total: 3, reserved: 0, collected: 2 });
    expect(() => collectStock(base, 1)).toThrow(/not reserved/);
  });
  it('rejects non-positive quantities', () => {
    expect(() => reserveStock(base, 0)).toThrow();
    expect(() => reserveStock(base, 1.5)).toThrow();
  });
  it('cannot reduce total below committed units', () => {
    expect(() => setTotalStock({ total: 3, reserved: 1, collected: 1 }, 1)).toThrow();
    expect(setTotalStock({ total: 3, reserved: 1, collected: 1 }, 2).total).toBe(2);
  });
});
