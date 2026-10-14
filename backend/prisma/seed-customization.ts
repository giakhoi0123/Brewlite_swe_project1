import { PrismaClient } from '@prisma/client';
import { sampleProducts } from './seed-products';
import { seedProductCustomization } from './seed-product-customization';

// Standalone product-only seed. Never reads or updates User/auth data.
const prisma = new PrismaClient();
async function main() {
  await prisma.product.createMany({ data: sampleProducts, skipDuplicates: true });
  await seedProductCustomization(prisma);
}
main()
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
