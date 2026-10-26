ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;

CREATE TABLE "loyalty_logs" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "points" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loyalty_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_logs_points_positive" CHECK ("points" > 0),
  CONSTRAINT "loyalty_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "loyalty_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "loyalty_logs_order_id_key" ON "loyalty_logs"("order_id");
CREATE INDEX "loyalty_logs_user_id_created_at_idx" ON "loyalty_logs"("user_id", "created_at");
