ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'VNPAY_QR';

ALTER TABLE "payments"
  ADD COLUMN "vnp_txn_ref" TEXT,
  ADD COLUMN "payment_url" TEXT,
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "vnp_transaction_no" TEXT,
  ADD COLUMN "vnp_response_code" TEXT,
  ADD COLUMN "vnp_transaction_status" TEXT,
  ADD COLUMN "vnp_bank_code" TEXT,
  ADD COLUMN "vnp_card_type" TEXT,
  ADD COLUMN "vnp_pay_date" TEXT,
  ADD COLUMN "processed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "payments_vnp_txn_ref_key"
  ON "payments"("vnp_txn_ref");

-- A pre-migration PROCESSING row only came from the synchronous mock gateway.
-- It can never receive a real VNPAY callback and must not block a real attempt.
UPDATE "payments"
SET "status" = 'UNKNOWN', "updated_at" = CURRENT_TIMESTAMP
WHERE "status" = 'PROCESSING' AND "vnp_txn_ref" IS NULL;

-- Only one chargeable VNPAY attempt may be open or paid for an order.
-- UNKNOWN is intentionally excluded so converted legacy mock rows do not block deploy.
CREATE UNIQUE INDEX "payments_one_active_per_order_key"
  ON "payments"("order_id")
  WHERE "status" IN ('PROCESSING', 'PAID');
