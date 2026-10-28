import { Prisma, PrismaClient } from '@prisma/client';

export const ingredientFixture = () => ({
  id: '90000000-0000-4000-8000-000000000001', name: 'Test milk', unit: 'ML' as const,
  stock: new Prisma.Decimal(100000), version: 1,
});
export const recipeFixture = () => [{
  ingredientId: ingredientFixture().id, amount: new Prisma.Decimal(10),
  ingredient: ingredientFixture(),
  productSizeId: '90000000-0000-4000-8000-000000000002',
  toppingId: '90000000-0000-4000-8000-000000000003',
}];

// Each integration suite owns this UUID and deletes it after its orders/catalog fixtures.
export async function seedFixtureRecipes(db: PrismaClient, id: string, productIds: string[], toppingIds: string[] = []) {
  await db.ingredient.upsert({ where: { id },
    create: { id, name: `Fixture ${id}`, unit: 'ML', stock: 1000000 },
    update: { stock: 1000000, version: 1 },
  });
  const sizes = await db.productSize.findMany({ where: { productId: { in: productIds } } });
  await db.productRecipe.createMany({ data: sizes.map((size) => ({ productSizeId: size.id, ingredientId: id, amount: 10 })), skipDuplicates: true });
  if (toppingIds.length) await db.toppingRecipe.createMany({ data: toppingIds.map((toppingId) => ({ toppingId, ingredientId: id, amount: 5 })), skipDuplicates: true });
}
