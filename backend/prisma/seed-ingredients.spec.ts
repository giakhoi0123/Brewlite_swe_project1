import { PrismaClient } from '@prisma/client';
import { sampleProducts } from './seed-products';
import { sampleToppings, seedProductCustomization } from './seed-product-customization';
import { seedIngredients } from './seed-ingredients';

const url = process.env.ORDERS_TEST_DATABASE_URL;
const database = url ? describe : describe.skip;
database('Ingredient seed on isolated PostgreSQL', () => {
  let db: PrismaClient;
  let ingredientIds: string[] = [];
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: url! } } });
    await db.product.createMany({ data: sampleProducts });
    await seedProductCustomization(db);
  });
  afterAll(async () => {
    await db.product.deleteMany({ where: { id: { in: sampleProducts.map((p) => p.id) } } });
    await db.topping.deleteMany({ where: { id: { in: sampleToppings.map((t) => t.id) } } });
    await db.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
    await db.$disconnect();
  });

  it('covers all 30 sizes and 2 toppings without resetting stock or edited recipes on rerun', async () => {
    const before = new Set((await db.ingredient.findMany()).map((i) => i.id));
    await seedIngredients(db);
    ingredientIds = (await db.ingredient.findMany()).map((i) => i.id).filter((id) => !before.has(id));
    const sizes = await db.productSize.findMany({ where: { productId: { in: sampleProducts.map((p) => p.id) } }, include: { recipe: true } });
    expect(sizes).toHaveLength(30);
    expect(sizes.every((s) => s.recipe.length > 0)).toBe(true);
    const toppings = await db.topping.findMany({ where: { id: { in: sampleToppings.map((t) => t.id) } }, include: { recipe: true } });
    expect(toppings.every((t) => t.recipe.length > 0)).toBe(true);
    const size = sizes[0], row = size.recipe[0];
    await db.ingredient.update({ where: { id: row.ingredientId }, data: { stock: '0.125' } });
    await db.productRecipe.deleteMany({ where: { productSizeId: size.id, ingredientId: { not: row.ingredientId } } });
    await db.productRecipe.update({ where: { productSizeId_ingredientId: { productSizeId: size.id, ingredientId: row.ingredientId } }, data: { amount: '0.375' } });
    await seedIngredients(db);
    expect((await db.ingredient.findUniqueOrThrow({ where: { id: row.ingredientId } })).stock.toString()).toBe('0.125');
    const recipe = await db.productRecipe.findMany({ where: { productSizeId: size.id } });
    expect(recipe).toHaveLength(1);
    expect(recipe[0].amount.toString()).toBe('0.375');
  });
});
