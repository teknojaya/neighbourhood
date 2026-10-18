ALTER TABLE "notifications"
  ADD COLUMN "push_sent_at" TIMESTAMPTZ(3),
  ADD COLUMN "push_started_at" TIMESTAMPTZ(3),
  ADD COLUMN "push_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "next_push_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Existing inbox history must not turn into a burst of old push messages.
UPDATE "notifications" SET "push_sent_at" = CURRENT_TIMESTAMP;
CREATE INDEX "notifications_pending_push" ON "notifications" ("next_push_at") WHERE "push_sent_at" IS NULL;
