ALTER TABLE "ask_runs" ADD COLUMN "progress" VARCHAR(30) NOT NULL DEFAULT 'thinking', ADD COLUMN "partial_text" TEXT NOT NULL DEFAULT '';
