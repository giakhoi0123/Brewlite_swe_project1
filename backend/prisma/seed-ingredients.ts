import { Ingredient, IngredientUnit, Prisma, PrismaClient } from '@prisma/client';
import { sampleProducts } from './seed-products';
import { sampleToppings } from './seed-product-customization';

// Illustrative development recipes only. Owners should replace with the shop's measured recipes.
const definitions: [string, IngredientUnit, number][] = [
  ['Cà phê rang xay', 'G', 10000], ['Sữa tươi', 'ML', 20000],
  ['Sữa đặc', 'ML', 10000], ['Kem cheese', 'G', 10000],
  ['Trà khô', 'G', 10000], ['Đào', 'G', 10000], ['Cam', 'ML', 10000],
  ['Sả', 'G', 10000], ['Mãng cầu', 'G', 10000], ['Matcha', 'G', 10000],
  ['Kem trứng', 'G', 10000], ['Vải', 'G', 10000], ['Syrup hoa hồng', 'ML', 10000],
  ['Cacao', 'G', 10000], ['Hạnh nhân', 'G', 10000], ['Chanh', 'ML', 10000],
  ['Muối', 'G', 1000],
];
// Ingredient index and amount per M cup. S = 75%, L = 125%; measured in the base unit above.
const recipes: [number, number][][] = [
  [[0, 20], [1, 30], [2, 25]],
  [[0, 20], [1, 30], [3, 20], [16, 0.5]],
  [[4, 8], [5, 40], [6, 30], [7, 3]],
  [[4, 8], [8, 50]],
  [[4, 10], [1, 100], [2, 25]],
  [[9, 5], [1, 120], [10, 20]],
  [[0, 25], [6, 40]],
  [[4, 8], [11, 40], [12, 15]],
  [[13, 15], [1, 100], [14, 10]],
  [[4, 8], [15, 30]],
];

export async function seedIngredients(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    const ingredients: Ingredient[] = [];
    for (const [name, unit, stock] of definitions) {
      const ingredient = await tx.ingredient.upsert({ where: { name }, update: {}, create: { name, unit, stock } });
      if (ingredient.unit !== unit) throw new Error(`Đơn vị nguyên liệu không khớp: ${name}`);
      ingredients.push(ingredient);
    }
    for (const [index, product] of sampleProducts.entries()) {
      const sizes = await tx.productSize.findMany({ where: { productId: product.id }, include: { recipe: true } });
      for (const size of sizes) {
        if (size.recipe.length) continue; // Preserve the entire edited recipe, including intentional removals.
        const factor = { S: '0.75', M: '1', L: '1.25' }[size.code];
        await tx.productRecipe.createMany({ data: recipes[index].map(([ingredientIndex, amount]) => ({
          productSizeId: size.id, ingredientId: ingredients[ingredientIndex].id,
          amount: new Prisma.Decimal(amount).mul(factor),
        })) });
      }
    }
    const toppingRecipes: [number, number][][] = [[[0, 10]], [[3, 20], [1, 15]]];
    for (const [index, topping] of sampleToppings.entries()) {
      const existing = await tx.topping.findUnique({ where: { id: topping.id }, include: { recipe: true } });
      if (!existing || existing.recipe.length) continue;
      await tx.toppingRecipe.createMany({ data: toppingRecipes[index].map(([ingredientIndex, amount]) => ({
        toppingId: topping.id, ingredientId: ingredients[ingredientIndex].id, amount,
      })) });
    }
  });
}
