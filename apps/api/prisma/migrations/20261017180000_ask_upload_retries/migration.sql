-- Existing photos remain readable. New uploads store a key and source hash.
ALTER TABLE "ask_attachments" ADD COLUMN "upload_key" VARCHAR(128), ADD COLUMN "source_hash" VARCHAR(64);
CREATE UNIQUE INDEX "ask_attachments_session_id_upload_key_key" ON "ask_attachments"("session_id", "upload_key");
