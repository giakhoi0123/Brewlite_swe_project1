-- Incrementing this value invalidates every JWT issued before logout.
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
