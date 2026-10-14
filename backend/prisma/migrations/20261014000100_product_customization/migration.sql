-- Additive only: existing prices, stock and all auth data are preserved.
ALTER TABLE "products" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

CREATE TYPE "ProductSizeCode" AS ENUM ('S', 'M', 'L');

CREATE TABLE "product_sizes" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" "ProductSizeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "extra_price" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_sizes_extra_price_nonnegative" CHECK ("extra_price" >= 0),
    CONSTRAINT "product_sizes_name_nonempty" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "product_sizes_default_available" CHECK (NOT "is_default" OR "available"),
    CONSTRAINT "product_sizes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "product_sizes_product_id_code_key" ON "product_sizes"("product_id", "code");
-- Prisma cannot express a partial unique index. Together with the FK this keeps
-- the one marked default inside its product; API checks that a default exists.
CREATE UNIQUE INDEX "product_sizes_one_default_per_product" ON "product_sizes"("product_id") WHERE "is_default";

CREATE TABLE "toppings" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "toppings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "toppings_name_nonempty" CHECK (length(btrim("name")) > 0)
);

CREATE TABLE "product_toppings" (
    "product_id" UUID NOT NULL,
    "topping_id" UUID NOT NULL,
    "extra_price" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "product_toppings_pkey" PRIMARY KEY ("product_id", "topping_id"),
    CONSTRAINT "product_toppings_extra_price_nonnegative" CHECK ("extra_price" >= 0),
    CONSTRAINT "product_toppings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_toppings_topping_id_fkey" FOREIGN KEY ("topping_id") REFERENCES "toppings"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "product_toppings_topping_id_idx" ON "product_toppings"("topping_id");
