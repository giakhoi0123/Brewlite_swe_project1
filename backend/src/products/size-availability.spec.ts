import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma.service';
import { productDetailFixture } from '../../test/fixtures/product-detail';
import { recipeFixture } from '../../test/fixtures/ingredients';
import { recipeCapacity } from '../inventory/recipe-capacity';
import { assertCartAvailability } from '../inventory/cart-availability';

const decimal = (n: number | string) => new Prisma.Decimal(n);
function fixture() {
  const p = productDetailFixture();
  p.stock = 100;
  p.sizes.forEach((s, index) => {
    s.available = true;
    s.recipe[0].amount = decimal([10, 20, 30][index]);
    s.recipe[0].ingredient.stock = decimal(360);
  });
  p.toppings[0].topping.recipe[0].ingredient.stock = decimal(360);
  return p;
}
const line = (quantity: number, size: 'S' | 'M' | 'L' = 'S', toppingIds: string[] = []) => ({
  productId: fixture().id, size, quantity, toppingIds,
});

describe('size capacity and complete cart availability', () => {
  it('returns stable size IDs with S=36, L=12 and keeps the summary compatible', async () => {
    const p = fixture();
    const service = new ProductsService({ product: { findUnique: async () => p } } as unknown as PrismaService);
    const detail = await service.findOne(p.id);
    expect(detail.sizes.map((s) => [s.id, s.stock])).toEqual(p.sizes.map((s, i) => [s.id, [36, 18, 12][i]]));
    expect(detail.stock).toBe(36);
    const milk = recipeFixture()[0];
    milk.ingredientId = 'milk'; milk.ingredient.stock = decimal(155); milk.amount = decimal(30);
    p.sizes[2].recipe.push(milk);
    expect((await service.findOne(p.id)).sizes[2].stock).toBe(5);
    milk.ingredient.stock = decimal(0);
    expect((await service.findOne(p.id)).sizes[2]).toMatchObject({ stock: 0, available: false });
    p.sizes[0].recipe = [];
    expect((await service.findOne(p.id)).sizes[0].stock).toBe(0);
    p.stock = 0;
    // Sizes stock is 100% computed from ingredients recipe, Product.stock is completely ignored
    expect((await service.findOne(p.id)).sizes[1].stock).toBe(18);
    expect((await service.findOne(p.id)).sizes[1].available).toBe(true);
  });

  it('sums repeated recipe ingredients before dividing, handles decimals and invalid data', () => {
    const row = fixture().sizes[0].recipe[0];
    expect(recipeCapacity([row, { ...row, amount: decimal(20) }])).toBe(12);
    expect(recipeCapacity([{ ...row, amount: decimal('0.125'), ingredient: { stock: decimal('0.374') } }])).toBe(2);
    for (const amount of [0, -1, 'NaN', 'Infinity']) expect(recipeCapacity([{ ...row, amount: decimal(amount) }])).toBe(0);
    expect(recipeCapacity([{ ...row, ingredient: { stock: decimal(-1) } }])).toBe(0);
  });

  it('combines repeated lines, sizes, different products and toppings without reserving', () => {
    const p = fixture();
    expect(() => assertCartAvailability([line(20), line(5, 'L')], [p])).not.toThrow();
    expect(() => assertCartAvailability([line(20), line(6, 'L')], [p])).toThrow('Không đủ nguyên vật liệu');
    expect(() => assertCartAvailability([line(20), line(17)], [p])).toThrow('Không đủ nguyên vật liệu');
    const other = { ...p, id: 'other' };
    expect(() => assertCartAvailability([line(20), { ...line(6, 'L'), productId: other.id }], [p, other])).toThrow('Không đủ');
    const topping = p.toppings[0].topping.id; // one 10g serving per cup
    expect(() => assertCartAvailability([line(12, 'L', [topping])], [p])).toThrow('Không đủ');
    expect(() => assertCartAvailability([line(9, 'L', [topping])], [p])).not.toThrow();
    expect(p.sizes[0].recipe[0].ingredient.stock.toNumber()).toBe(360);
  });

  it('rejects missing/invalid topping recipes and newly depleted inventory', () => {
    const p = fixture();
    const topping = p.toppings[0].topping;
    topping.recipe = [];
    expect(() => assertCartAvailability([line(1, 'S', [topping.id])], [p])).toThrow('định mức');
    p.sizes[0].recipe[0].ingredient.stock = decimal(9);
    expect(() => assertCartAvailability([line(1)], [p])).toThrow('Không đủ');
  });
});
