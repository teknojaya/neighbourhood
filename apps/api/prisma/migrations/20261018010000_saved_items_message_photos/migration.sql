CREATE TABLE "conversation_attachments" (
  "id" UUID NOT NULL, "conversation_id" UUID NOT NULL, "uploader_id" UUID NOT NULL,
  "message_id" UUID, "storage_path" VARCHAR(300) NOT NULL,
  "mime_type" VARCHAR(40) NOT NULL, "size" INTEGER NOT NULL,
  "upload_key" VARCHAR(128) NOT NULL, "source_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversation_attachments_size" CHECK ("size" > 0 AND "size" <= 4194304),
  CONSTRAINT "conversation_attachments_mime" CHECK ("mime_type" = 'image/webp'),
  CONSTRAINT "conversation_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversation_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversation_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "conversation_attachments_storage_path_key" ON "conversation_attachments"("storage_path");
CREATE UNIQUE INDEX "conversation_attachments_conversation_id_uploader_id_upload_key_key" ON "conversation_attachments"("conversation_id", "uploader_id", "upload_key");
CREATE INDEX "conversation_attachments_message_id_idx" ON "conversation_attachments"("message_id");
CREATE INDEX "conversation_attachments_conversation_id_uploader_id_created_at_idx" ON "conversation_attachments"("conversation_id", "uploader_id", "created_at");

CREATE TABLE "saved_listings" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "listing_id" UUID NOT NULL,
  "title" VARCHAR(100) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saved_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "saved_listings_user_id_listing_id_key" ON "saved_listings"("user_id", "listing_id");
CREATE INDEX "saved_listings_user_id_created_at_id_idx" ON "saved_listings"("user_id", "created_at", "id");
