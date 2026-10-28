import type { Prisma } from '@prisma/client';

export const productDetailSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  stock: true,
  sizes: {
    select: { id: true, code: true, name: true, extraPrice: true, available: true, isDefault: true, recipe: { include: { ingredient: true } } },
    orderBy: { code: 'asc' },
  },
  toppings: {
    select: { extraPrice: true, available: true, topping: { select: { id: true, name: true, recipe: { include: { ingredient: true } } } } },
    orderBy: { toppingId: 'asc' },
  },
} satisfies Prisma.ProductSelect;

export type ProductDetailRecord = Prisma.ProductGetPayload<{ select: typeof productDetailSelect }>;
export type ProductDetail = Omit<ProductDetailRecord, 'sizes' | 'toppings'> & {
  sizes: Omit<ProductDetailRecord['sizes'][number], 'isDefault' | 'recipe'>[];
  toppings: { id: string; name: string; extraPrice: number; available: boolean }[];
  defaultSizeId: string;
};
