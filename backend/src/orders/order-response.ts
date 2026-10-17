import { Prisma } from '@prisma/client';

export const orderInclude = {
  items: {
    orderBy: { position: 'asc' },
    include: {
      toppings: { orderBy: { toppingId: 'asc' } },
    },
  },
  payments: {
    where: { status: 'PAID' },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { method: true },
  },
} satisfies Prisma.OrderInclude;

export type OrderRecord = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export function orderResponse(order: OrderRecord) {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    subtotal: order.subtotal,
    discount: order.discountAmount,
    total: order.total,
    ...(order.promotionCode ? { promotionCode: order.promotionCode } : {}),
    ...(order.payments?.[0]
      ? { paymentMethod: order.payments[0].method }
      : {}),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      key: item.id,
      productId: item.productId,
      name: item.name,
      imageUrl: item.imageUrl,
      size: item.size,
      toppingIds: item.toppings.map((t) => t.toppingId),
      toppingNames: item.toppings.map((t) => t.name),
      unitPrice: item.unitPrice,
      quantity: item.qty,
      lineTotal: item.lineTotal,
      ice: item.ice,
      sugar: item.sugar,
      ...(item.note ? { note: item.note } : {}),
    })),
  };
}
