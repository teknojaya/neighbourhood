import { distanceBetween, geohashForLocation, geohashQueryBounds } from 'geofire-common';
import { z } from 'zod';
import type { ApproximateLocation, LatLng } from './common.js';

export const RADIUS_OPTIONS_KM = [1, 3, 5, 10] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];
export const DEFAULT_RADIUS_KM: RadiusKm = 3;

/** Accepts query-string input ("3") and only the supported radius options. */
export const RadiusKmSchema = z.coerce
  .number()
  .pipe(z.literal(RADIUS_OPTIONS_KM))
  .default(DEFAULT_RADIUS_KM);

export const GEOHASH_PRECISION = 9;

export function geohashFor(point: LatLng): string {
  return geohashForLocation([point.lat, point.lng], GEOHASH_PRECISION);
}

/** Straight-line (great-circle) distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  return distanceBetween([a.lat, a.lng], [b.lat, b.lng]);
}

/**
 * Geohash prefix ranges `[start, end]` that together cover a circle.
 * The PostgreSQL repository turns them into `geohash BETWEEN start AND end`
 * candidate predicates (btree, text_pattern_ops) and then filters by exact
 * great-circle distance in the same SQL statement.
 */
export function geohashRanges(center: LatLng, radiusKm: number): Array<[string, string]> {
  return geohashQueryBounds([center.lat, center.lng], radiusKm * 1000).map(
    ([start, end]) => [start, end] as [string, string],
  );
}

/** Rounds coordinates to 2 decimal places (~1.1 km) for public display. */
export function approximateLocation(
  exact: LatLng,
  areaLabel: string,
  distanceFromSearcherKm?: number,
): ApproximateLocation {
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    approxLat: round(exact.lat),
    approxLng: round(exact.lng),
    areaLabel,
    ...(distanceFromSearcherKm === undefined
      ? {}
      : { distanceKm: roundDistanceForDisplay(distanceFromSearcherKm) }),
  };
}

/** Rounds up to 0.5 km steps (minimum 0.5) to resist trilateration. */
export function roundDistanceForDisplay(km: number): number {
  return Math.max(0.5, Math.ceil(km * 2) / 2);
}
