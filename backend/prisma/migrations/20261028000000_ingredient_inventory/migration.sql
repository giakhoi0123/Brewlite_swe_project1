CREATE TYPE "IngredientUnit" AS ENUM ('G', 'ML', 'PIECE');
ALTER TABLE "orders" ADD COLUMN "ingredient_inventory" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ingredients" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "unit" "IngredientUnit" NOT NULL,
  "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ingredients_stock_check" CHECK ("stock" >= 0 AND "stock" < 1000000000),
  CONSTRAINT "ingredients_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

CREATE TABLE "product_recipes" (
  "product_size_id" UUID NOT NULL,
  "ingredient_id" UUID NOT NULL,
  "amount" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "product_recipes_pkey" PRIMARY KEY ("product_size_id", "ingredient_id"),
  CONSTRAINT "product_recipes_amount_check" CHECK ("amount" > 0 AND "amount" < 1000000000),
  CONSTRAINT "product_recipes_product_size_id_fkey" FOREIGN KEY ("product_size_id") REFERENCES "product_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_recipes_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "product_recipes_ingredient_id_idx" ON "product_recipes"("ingredient_id");

CREATE TABLE "topping_recipes" (
  "topping_id" UUID NOT NULL,
  "ingredient_id" UUID NOT NULL,
  "amount" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "topping_recipes_pkey" PRIMARY KEY ("topping_id", "ingredient_id"),
  CONSTRAINT "topping_recipes_amount_check" CHECK ("amount" > 0 AND "amount" < 1000000000),
  CONSTRAINT "topping_recipes_topping_id_fkey" FOREIGN KEY ("topping_id") REFERENCES "toppings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "topping_recipes_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "topping_recipes_ingredient_id_idx" ON "topping_recipes"("ingredient_id");

CREATE TABLE "order_ingredient_usage" (
  "order_id" UUID NOT NULL,
  "ingredient_id" UUID NOT NULL,
  "amount" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "order_ingredient_usage_pkey" PRIMARY KEY ("order_id", "ingredient_id"),
  CONSTRAINT "order_ingredient_usage_amount_check" CHECK ("amount" > 0 AND "amount" < 1000000000),
  CONSTRAINT "order_ingredient_usage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_ingredient_usage_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "order_ingredient_usage_ingredient_id_idx" ON "order_ingredient_usage"("ingredient_id");
