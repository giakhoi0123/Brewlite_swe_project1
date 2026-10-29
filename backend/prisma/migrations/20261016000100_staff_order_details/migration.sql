ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "cancel_reason" VARCHAR(300),
ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);

-- Recover actual completion times from existing transition history, not created_at.
-- Legacy rows without a completion event remain NULL; do not invent timestamps.
UPDATE "orders" AS o
SET "completed_at" = (
  SELECT MAX(h."created_at")
  FROM "order_status_history" AS h
  WHERE h."order_id" = o."id" AND h."to_status" = 'COMPLETED'
)
WHERE o."status" = 'COMPLETED';
