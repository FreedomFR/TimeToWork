-- Per-user display settings (animations, text size...), validated by the API
ALTER TABLE "User" ADD COLUMN "preferences" JSONB NOT NULL DEFAULT '{}';
