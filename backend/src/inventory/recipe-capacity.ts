import { Prisma } from '@prisma/client';

// A preview for one configuration; shared ingredients across cart lines are checked at checkout.
export function recipeCapacity(recipe: { ingredientId?: string; amount: Prisma.Decimal; ingredient: { stock: Prisma.Decimal } }[]): number {
  if (!recipe.length) return 0;
  const totals = new Map<string | number, { amount: Prisma.Decimal; stock: Prisma.Decimal }>();
  for (const [index, row] of recipe.entries()) {
    if (!row.amount.isFinite() || row.amount.lte(0) || !row.ingredient.stock.isFinite() || row.ingredient.stock.lt(0)) return 0;
    const key = row.ingredientId ?? index;
    const previous = totals.get(key);
    totals.set(key, { amount: row.amount.plus(previous?.amount ?? 0),
      stock: previous ? Prisma.Decimal.min(previous.stock, row.ingredient.stock) : row.ingredient.stock });
  }
  // Amount and stock are both stored in Ingredient.unit (G/ML/PIECE).
  return Math.min(2147483647, ...[...totals.values()].map(({ amount, stock }) => stock.div(amount).floor().toNumber()));
}
