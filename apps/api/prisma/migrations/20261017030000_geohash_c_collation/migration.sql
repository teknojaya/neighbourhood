-- Geohash candidate range scans must compare byte-wise: locale collations can
-- order the "~" range terminator differently. Queries use COLLATE "C" too.
DROP INDEX IF EXISTS "listings_active_geohash_pattern";
CREATE INDEX "listings_active_geohash_c" ON "listings" ("geohash" COLLATE "C") WHERE "status" = 'active';
CREATE INDEX "community_points_active_geohash_c" ON "community_points" ("geohash" COLLATE "C") WHERE "active";
