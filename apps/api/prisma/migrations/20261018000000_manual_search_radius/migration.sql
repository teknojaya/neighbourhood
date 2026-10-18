ALTER TABLE "users" DROP CONSTRAINT "users_search_radius_km";
ALTER TABLE "users" ADD CONSTRAINT "users_search_radius_km"
  CHECK ("search_radius_km" BETWEEN 1 AND 50);
