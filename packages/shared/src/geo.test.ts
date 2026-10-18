import { describe, expect, it } from 'vitest';
import { approximateLocation, distanceKm, geohashFor, geohashRanges, RadiusKmSchema, roundDistanceForDisplay } from './geo.js';

const monas = { lat: -6.1754, lng: 106.8272 };

describe('radius options', () => {
  it('defaults to 3 km and accepts bounded manual whole kilometres', () => {
    expect(RadiusKmSchema.parse(undefined)).toBe(3);
    expect(RadiusKmSchema.parse('5')).toBe(5);
    expect(RadiusKmSchema.parse('7')).toBe(7);
    expect(RadiusKmSchema.parse('50')).toBe(50);
    for (const invalid of ['', '0', '-1', '51', '2.5', 'Infinity', 'abc']) expect(RadiusKmSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('geohashRanges', () => {
  it('produces bounded candidate ranges that contain nearby points', () => {
    const ranges = geohashRanges(monas, 3);
    expect(ranges.length).toBeGreaterThan(0);
    expect(ranges.length).toBeLessThanOrEqual(9);
    const near = geohashFor({ lat: -6.18, lng: 106.83 });
    expect(ranges.some(([s, e]) => near >= s && near <= e)).toBe(true);
  });
});

describe('public location privacy', () => {
  it('rounds coordinates and distance', () => {
    const approx = approximateLocation({ lat: -6.175432, lng: 106.827189 }, 'Gambir', 1.23);
    expect(approx).toEqual({ approxLat: -6.18, approxLng: 106.83, areaLabel: 'Gambir', distanceKm: 1.5 });
    expect(roundDistanceForDisplay(0.01)).toBe(0.5);
    expect(distanceKm(monas, monas)).toBe(0);
  });
});
