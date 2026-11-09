ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ADMIN_APPROVAL';

ALTER TABLE "payments"
  ADD COLUMN "reviewed_by_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_note" VARCHAR(500);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "payments_method_status_created_at_idx"
  ON "payments"("method", "status", "created_at");
CREATE INDEX "payments_reviewed_by_id_idx"
  ON "payments"("reviewed_by_id");
