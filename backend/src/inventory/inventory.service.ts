import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type StockItem = { productId: string; qty: number };
export type StockSnapshot = { id: string; stock: number; version: number };

function quantities(items: StockItem[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.qty) || item.qty <= 0) {
      throw new BadRequestException('Số lượng không hợp lệ');
    }
    const total = (totals.get(item.productId) ?? 0) + item.qty;
    if (!Number.isSafeInteger(total) || total > 2147483647) {
      throw new BadRequestException('Số lượng vượt giới hạn');
    }
    totals.set(item.productId, total);
  }
  // All writers acquire product locks in the same order to avoid multi-item deadlocks.
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
}

@Injectable()
export class InventoryService {
  // Always use the caller's transaction; never commit inventory independently of the order.
  async reserve(
    tx: Prisma.TransactionClient,
    items: StockItem[],
    snapshots?: StockSnapshot[],
  ) {
    const totals = quantities(items);
    const products =
      snapshots ??
      (await tx.product.findMany({
        where: { id: { in: totals.map(([id]) => id) } },
        select: { id: true, stock: true, version: true },
      }));
    for (const [id, qty] of totals) {
      const product = products.find((p) => p.id === id);
      if (!product || product.stock < qty) {
        throw new ConflictException(`Sản phẩm ${id} không đủ tồn kho`);
      }
      const result = await tx.product.updateMany({
        where: { id, version: product.version, stock: { gte: qty } },
        data: { stock: { decrement: qty }, version: { increment: 1 } },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Tồn kho vừa thay đổi. Vui lòng kiểm tra giỏ và thử lại',
        );
      }
    }
  }

  // Caller must first win the order version CAS, preventing double release.
  async restore(tx: Prisma.TransactionClient, items: StockItem[]) {
    for (const [id, qty] of quantities(items)) {
      await tx.product.update({
        where: { id },
        data: { stock: { increment: qty }, version: { increment: 1 } },
      });
    }
  }
}
