CREATE TYPE "AdminPaymentCancelStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "payments"
ADD COLUMN "cancel_request_status" "AdminPaymentCancelStatus",
ADD COLUMN "cancel_request_reason" VARCHAR(300),
ADD COLUMN "cancel_requested_at" TIMESTAMP(3),
ADD COLUMN "cancel_reviewed_by_id" UUID,
ADD COLUMN "cancel_reviewed_at" TIMESTAMP(3),
ADD COLUMN "cancel_review_note" VARCHAR(500);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_cancel_reviewed_by_id_fkey"
FOREIGN KEY ("cancel_reviewed_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "payments_cancel_request_status_created_at_idx"
ON "payments"("cancel_request_status", "created_at");

CREATE INDEX "payments_cancel_reviewed_by_id_idx"
ON "payments"("cancel_reviewed_by_id");
