-- The existing Promotion Prisma model previously had no migration.
-- Preserve installations provisioned with db push; do not change existing promotions.
CREATE TABLE IF NOT EXISTS "Promotion" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "description" TEXT,
  "discountType" TEXT NOT NULL DEFAULT 'FIXED_AMOUNT',
  "discountValue" DOUBLE PRECISION NOT NULL,
  "minOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxDiscountAmount" DOUBLE PRECISION,
  "startDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Promotion_code_key" ON "Promotion"("code");
