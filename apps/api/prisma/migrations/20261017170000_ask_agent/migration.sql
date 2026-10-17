CREATE TABLE "ask_sessions" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "client_id" UUID NOT NULL,
  "title" VARCHAR(80) NOT NULL DEFAULT 'New chat', "next_sequence" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ask_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ask_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ask_sessions_user_id_client_id_key" ON "ask_sessions"("user_id", "client_id");
CREATE INDEX "ask_sessions_user_id_updated_at_idx" ON "ask_sessions"("user_id", "updated_at");

CREATE TABLE "ask_messages" (
  "id" UUID NOT NULL, "session_id" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "role" VARCHAR(12) NOT NULL CHECK ("role" IN ('user', 'assistant')),
  "text" TEXT NOT NULL DEFAULT '', "parts" JSONB NOT NULL DEFAULT '[]',
  "attachment_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ask_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ask_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ask_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ask_messages_session_id_sequence_key" ON "ask_messages"("session_id", "sequence");

CREATE TABLE "ask_runs" (
  "id" UUID NOT NULL, "session_id" UUID NOT NULL, "client_message_id" UUID NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL, "attempt_id" UUID NOT NULL, "status" VARCHAR(12) NOT NULL DEFAULT 'running' CHECK ("status" IN ('running', 'completed', 'failed', 'cancelled')),
  "error_code" VARCHAR(40), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ask_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ask_runs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ask_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ask_runs_session_id_client_message_id_key" ON "ask_runs"("session_id", "client_message_id");
CREATE INDEX "ask_runs_session_id_created_at_idx" ON "ask_runs"("session_id", "created_at");
CREATE UNIQUE INDEX "ask_runs_one_running" ON "ask_runs"("session_id") WHERE "status" = 'running';

CREATE TABLE "ask_attachments" (
  "id" UUID NOT NULL, "session_id" UUID NOT NULL, "storage_path" VARCHAR(300) NOT NULL,
  "name" VARCHAR(120) NOT NULL, "mime_type" VARCHAR(40) NOT NULL CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 4194304),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ask_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ask_attachments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ask_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ask_attachments_storage_path_key" ON "ask_attachments"("storage_path");
CREATE INDEX "ask_attachments_session_id_idx" ON "ask_attachments"("session_id");

CREATE TABLE "ask_actions" (
  "id" UUID NOT NULL, "session_id" UUID NOT NULL, "run_id" UUID NOT NULL,
  "payload" JSONB NOT NULL, "summary" VARCHAR(300) NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'executing', 'completed', 'cancelled', 'expired')),
  "error_code" VARCHAR(40), "receipt" JSONB, "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "started_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ask_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ask_actions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ask_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ask_actions_session_id_idx" ON "ask_actions"("session_id");

CREATE TABLE "ask_drafts" (
  "id" UUID NOT NULL, "session_id" UUID NOT NULL, "kind" VARCHAR(20) NOT NULL,
  "data" JSONB NOT NULL, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ask_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ask_drafts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ask_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ask_drafts_session_id_kind_key" ON "ask_drafts"("session_id", "kind");
