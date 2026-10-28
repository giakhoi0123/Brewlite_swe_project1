import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type StockItem = { productId: string; qty: number };
export type StockSnapshot = { id: string; stock: number; version: number };
export type IngredientAmount = { ingredientId: string; amount: Prisma.Decimal };
export type RecipeProduct = {
  id: string;
  sizes: { code: string; recipe: IngredientAmount[] }[];
  toppings: { toppingId: string; topping: { recipe: IngredientAmount[] } }[];
};

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
  // Each selected topping is one serving per cup, matching the existing cart contract.
  demand(
    items: { productId: string; size: string; quantity: number; toppingIds: string[] }[],
    products: RecipeProduct[],
  ): IngredientAmount[] {
    const totals = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)
        throw new BadRequestException('Số lượng không hợp lệ');
      const product = products.find((p) => p.id === item.productId);
      const base = product?.sizes.find((s) => s.code === item.size)?.recipe;
      const recipes = [base, ...item.toppingIds.map((id) =>
        product?.toppings.find((t) => t.toppingId === id)?.topping.recipe)];
      for (const recipe of recipes) {
        if (!recipe?.length)
          throw new ConflictException('Món hoặc topping chưa có định mức nguyên vật liệu');
        for (const row of recipe) {
          if (!row.amount.isFinite() || row.amount.lte(0))
            throw new ConflictException('Định mức nguyên vật liệu không hợp lệ');
          const total = (totals.get(row.ingredientId) ?? new Prisma.Decimal(0))
            .plus(row.amount.mul(item.quantity));
          if (total.gte(1000000000)) throw new BadRequestException('Lượng nguyên liệu vượt giới hạn');
          totals.set(row.ingredientId, total);
        }
      }
    }
    return [...totals].sort(([a], [b]) => a.localeCompare(b))
      .map(([ingredientId, amount]) => ({ ingredientId, amount }));
  }

  async reserveIngredients(tx: Prisma.TransactionClient, usage: IngredientAmount[]) {
    if (!usage.length) throw new ConflictException('Đơn chưa có định mức nguyên vật liệu');
    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: usage.map((row) => row.ingredientId) } },
    });
    // Same lock order for every writer, including release and retry.
    for (const row of [...usage].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))) {
      const ingredient = ingredients.find((i) => i.id === row.ingredientId);
      if (!ingredient || ingredient.stock.lt(row.amount))
        throw new ConflictException(`Không đủ nguyên vật liệu: ${ingredient?.name ?? row.ingredientId}`);
      const changed = await tx.ingredient.updateMany({
        where: { id: row.ingredientId, version: ingredient.version, stock: { gte: row.amount } },
        data: { stock: { decrement: row.amount }, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('Kho nguyên liệu vừa thay đổi. Vui lòng thử lại');
    }
  }

  async restoreIngredients(tx: Prisma.TransactionClient, usage: IngredientAmount[]) {
    if (!usage.length) throw new ConflictException('Đơn thiếu snapshot nguyên vật liệu');
    for (const row of [...usage].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))) {
      const changed = await tx.ingredient.updateMany({
        where: { id: row.ingredientId, stock: { lte: new Prisma.Decimal('999999999.999').minus(row.amount) } },
        data: { stock: { increment: row.amount }, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException('Không thể hoàn kho nguyên vật liệu');
    }
  }

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
