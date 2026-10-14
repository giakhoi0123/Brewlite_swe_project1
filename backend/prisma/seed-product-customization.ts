import type { Prisma, PrismaClient } from '@prisma/client';
import { sampleProducts } from './seed-products';

// Development data adopted from the T4.1 example, not prices from design exports.
export const sampleToppings = [
  { id: 'b4151b67-4044-43ce-9cac-000000000001', name: 'Thêm espresso' },
  { id: 'b4151b67-4044-43ce-9cac-000000000002', name: 'Kem cheese' },
] satisfies Prisma.ToppingCreateManyInput[];

const descriptions: Record<string, string> = {
  '31a650c7-8597-4a01-a8e2-000000000001': 'Cà phê và sữa, phục vụ lạnh.',
  '31a650c7-8597-4a01-a8e2-000000000002': 'Cà phê với lớp kem muối béo nhẹ.',
  '31a650c7-8597-4a01-a8e2-000000000003': 'Trà đào kết hợp cam và sả.',
  '31a650c7-8597-4a01-a8e2-000000000004': 'Trà với mãng cầu thơm dịu.',
  '31a650c7-8597-4a01-a8e2-000000000005': 'Trà Oolong nướng kết hợp sữa.',
  '31a650c7-8597-4a01-a8e2-000000000006': 'Matcha sữa với kem trứng.',
  '31a650c7-8597-4a01-a8e2-000000000007': 'Cà phê ủ lạnh kết hợp cam.',
  '31a650c7-8597-4a01-a8e2-000000000008': 'Trà vải hương hoa hồng.',
  '31a650c7-8597-4a01-a8e2-000000000009': 'Cacao sữa với hạnh nhân.',
  '31a650c7-8597-4a01-a8e2-000000000010': 'Trà chanh tươi, phục vụ lạnh.',
};
// Explicit assignments by persistent Product ID, never guessed by product name.
const espressoProducts = new Set([
  '31a650c7-8597-4a01-a8e2-000000000001',
  '31a650c7-8597-4a01-a8e2-000000000002',
  '31a650c7-8597-4a01-a8e2-000000000007',
]);

export const sampleCustomizations = sampleProducts.map((product) => {
  // Fixed seed Product UUID suffix, not its array position: reordering preserves size IDs.
  const productNumber = Number(product.id.slice(-12));
  const sizes = (['S', 'M', 'L'] as const).map((code, offset) => ({
    id: `c075421a-1160-4e94-84d4-${String(productNumber * 3 - 2 + offset).padStart(12, '0')}`,
    productId: product.id,
    code,
    name: { S: 'Nhỏ (S)', M: 'Vừa (M)', L: 'Lớn (L)' }[code],
    extraPrice: { S: 0, M: 4000, L: 9000 }[code],
    available: true,
    isDefault: code === 'M',
  })) satisfies Prisma.ProductSizeCreateManyInput[];
  const toppings = sampleToppings
    .filter((topping) => topping.id === sampleToppings[1].id || espressoProducts.has(product.id))
    .map((topping) => ({
      productId: product.id,
      toppingId: topping.id,
      extraPrice: topping.id === sampleToppings[0].id ? 7000 : 6000,
      available: true,
    })) satisfies Prisma.ProductToppingCreateManyInput[];
  return { productId: product.id, description: descriptions[product.id], sizes, toppings };
});

export async function seedProductCustomization(prisma: PrismaClient): Promise<void> {
  for (const config of sampleCustomizations) {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: config.productId }, select: { sizes: { select: { id: true } } } });
      if (!product) return;
      // Preserve edited descriptions, all current base prices/stock and existing size configurations.
      await tx.product.updateMany({ where: { id: config.productId, description: '' }, data: { description: config.description } });
      await tx.topping.createMany({ data: sampleToppings, skipDuplicates: true });
      if (product.sizes.length === 0) {
        await tx.productSize.createMany({ data: config.sizes, skipDuplicates: true });
      }
      await tx.productTopping.createMany({ data: config.toppings, skipDuplicates: true });
    });
  }
}
