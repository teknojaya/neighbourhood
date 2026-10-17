ALTER TABLE "ask_actions" ADD COLUMN "first_started_at" TIMESTAMPTZ(3);
UPDATE "ask_actions" SET "first_started_at" = "started_at" WHERE "started_at" IS NOT NULL;
