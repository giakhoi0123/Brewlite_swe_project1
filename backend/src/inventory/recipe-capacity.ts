import { Prisma } from '@prisma/client';

// A preview for one configuration; shared ingredients across cart lines are checked at checkout.
export function recipeCapacity(recipe: { amount: Prisma.Decimal; ingredient: { stock: Prisma.Decimal } }[]): number {
  if (!recipe.length) return 0;
  return Math.min(2147483647, ...recipe.map((line) =>
    line.amount.gt(0) ? line.ingredient.stock.div(line.amount).floor().toNumber() : 0));
}
