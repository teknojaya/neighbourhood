ALTER TABLE "listings" ADD COLUMN "point_inventory_item_id" UUID;
CREATE UNIQUE INDEX "listings_point_inventory_item_id_key" ON "listings" ("point_inventory_item_id");
ALTER TABLE "listings" ADD CONSTRAINT "listings_point_inventory_item_id_fkey" FOREIGN KEY ("point_inventory_item_id") REFERENCES "point_inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Retain legacy records and approved handovers, but stop new reservations on
-- point listings whose physical inventory has never been linked.
UPDATE "listings" SET "status" = 'paused', "updated_at" = CURRENT_TIMESTAMP WHERE "community_point_id" IS NOT NULL AND "point_inventory_item_id" IS NULL AND "status" = 'active';
