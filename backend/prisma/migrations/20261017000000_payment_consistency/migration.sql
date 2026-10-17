-- Durable gateway journal. Audit legacy Payment/Order discrepancies before deploy.
BEGIN;
ALTER TABLE "payments"
  ADD COLUMN "gateway_status" "PaymentStatus",
  ADD COLUMN "applied_at" TIMESTAMP(3);

ALTER TABLE "payments" ADD CONSTRAINT "payments_gateway_result_check"
  CHECK ("gateway_status" IS NULL OR "gateway_status" <> 'PROCESSING');
ALTER TABLE "payments" ADD CONSTRAINT "payments_applied_result_check"
  CHECK ("applied_at" IS NULL OR (
    "status" <> 'PROCESSING' AND "gateway_status" IS NOT NULL
    AND "status" = "gateway_status"
  ));

-- Fail safely on duplicate live legacy attempts; never delete financial records.
CREATE UNIQUE INDEX "payments_one_live_attempt_per_order"
  ON "payments" ("order_id")
  WHERE "status" IN ('PROCESSING', 'UNKNOWN', 'PAID');
COMMIT;
