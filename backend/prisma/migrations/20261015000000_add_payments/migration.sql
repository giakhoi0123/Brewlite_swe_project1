CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CARD');
CREATE TYPE "PaymentStatus" AS ENUM (
  'PROCESSING',
  'PAID',
  'PAYMENT_FAILED',
  'UNKNOWN'
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PROCESSING',
  "idempotency_key" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_amount_nonnegative" CHECK ("amount" >= 0),
  CONSTRAINT "payments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payments_user_id_idempotency_key_key"
  ON "payments"("user_id", "idempotency_key");
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- TV4 will add the order_id foreign key when the orders table lands.
