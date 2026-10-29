import { ConflictException, NotFoundException } from '@nestjs/common';
import { assertSelection } from '../cart/cart-pricing';
import type { ProductDetailRecord } from '../products/product-detail';
import type { CreateOrderItemDto } from '../orders/dto/create-order.dto';
import { InventoryService } from './inventory.service';

/** Read-only preview of the entire proposed cart. Never reserves inventory. */
export function assertCartAvailability(
  items: Pick<CreateOrderItemDto, 'productId' | 'size' | 'quantity' | 'toppingIds'>[],
  products: ProductDetailRecord[],
) {
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    assertSelection(product, item);
  }
  const usage = new InventoryService().demand(items, products.map((p) => ({
    ...p, toppings: p.toppings.map((t) => ({ ...t, toppingId: t.topping.id })),
  })));
  const ingredients = new Map<string, ProductDetailRecord['sizes'][number]['recipe'][number]['ingredient']>();
  for (const row of products.flatMap((p) => [
    ...p.sizes.flatMap((s) => s.recipe), ...p.toppings.flatMap((t) => t.topping.recipe),
  ])) {
    const previous = ingredients.get(row.ingredientId);
    // Never let a later relation snapshot overstate the same shared ingredient.
    if (!previous || !row.ingredient.stock.isFinite() || row.ingredient.stock.lt(previous.stock))
      ingredients.set(row.ingredientId, row.ingredient);
  }
  const missing: string[] = [];
  for (const row of usage) {
    const ingredient = ingredients.get(row.ingredientId);
    if (!ingredient || !ingredient.stock.isFinite() || ingredient.stock.lt(row.amount)) {
      const name = ingredient?.name ?? row.ingredientId;
      if (!missing.includes(name)) {
        missing.push(name);
      }
    }
  }
  if (missing.length > 0) {
    throw new ConflictException(
      `Không đủ nguyên vật liệu: ${missing.join(', ')}. Vui lòng chọn món khác hoặc giảm số lượng!`,
    );
  }
}
