import { PrismaClient } from '@prisma/client';
import { seedProductCustomization } from './seed-product-customization';
import { seedIngredients } from './seed-ingredients';

const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Sample inventory is development-only');
  await seedProductCustomization(prisma);
  await seedIngredients(prisma);
  console.log('Sample inventory recipes added; existing stock and recipes preserved.');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
