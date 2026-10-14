import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { sampleProducts } from './seed-products';
import { seedProductCustomization } from './seed-product-customization';

const prisma = new PrismaClient();

async function provisionBarista() {
  const email = process.env.BARISTA_EMAIL?.trim().toLowerCase();
  const password = process.env.BARISTA_PASSWORD;
  if (!email && !password) return;
  if (process.env.NODE_ENV === 'production') throw new Error('Không chạy seed nhân viên trong production');
  if (!email || !password || password.length < 8) throw new Error('Cần BARISTA_EMAIL và BARISTA_PASSWORD (ít nhất 8 ký tự)');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== Role.BARISTA) throw new Error('Email đã thuộc về tài khoản không phải Barista');
    console.log('Tài khoản Barista đã tồn tại');
    return;
  }
  await prisma.user.create({
    data: { email, fullName: process.env.BARISTA_NAME?.trim() || 'Nhân viên pha chế', passwordHash: await bcrypt.hash(password, 10), role: Role.BARISTA },
  });
  console.log('Đã tạo tài khoản Barista');
}

async function main() {
  await provisionBarista();
  // Insert only: re-running seed must not restock products or overwrite edited prices.
  await prisma.product.createMany({ data: sampleProducts, skipDuplicates: true });
  await seedProductCustomization(prisma);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
