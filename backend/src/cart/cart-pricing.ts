import { UnprocessableEntityException } from '@nestjs/common';
import type { ProductSizeCode } from '@prisma/client';
import type { ProductDetailRecord } from '../products/product-detail';

export const MAX_LINE_QUANTITY = 99;
export const NOTE_MAX_LENGTH = 120;
export const ICE_LEVELS = ['100% đá', '70% đá', '30% đá', 'Không đá'] as const;
export const SUGAR_LEVELS = ['100% chuẩn', '70% ngọt vừa', '50% ít ngọt', 'Không đường'] as const;

export type CartSelection = { size: ProductSizeCode; toppingIds: string[] };
export type PricedSelection = {
  unitPrice: number;
  sizeName: string;
  toppings: { id: string; name: string; extraPrice: number }[];
  problems: string[];
};

/** UUID không phân biệt hoa/thường, không trùng, có thứ tự để so sánh cấu hình. */
export const normalizeToppingIds = (ids: string[]) =>
  [...new Set(ids.map((id) => id.toLowerCase()))].sort();

/** Hai dòng giỏ có cùng khóa này được gộp số lượng thay vì tạo dòng mới. */
export const cartConfigKey = (line: {
  size: ProductSizeCode;
  toppingIds: string[];
  ice: string;
  sugar: string;
  note: string;
}) =>
  [line.size, normalizeToppingIds(line.toppingIds).join(','), line.ice, line.sugar, line.note.trim()].join('|');

/**
 * Tính đơn giá từ dữ liệu sản phẩm hiện tại (giá gốc + size + topping).
 * Không ném lỗi: các vấn đề (size/topping không hợp lệ hoặc tạm hết) trả về trong `problems`.
 */
export function priceSelection(product: ProductDetailRecord, selection: CartSelection): PricedSelection {
  const problems: string[] = [];
  const size = product.sizes.find((option) => option.code === selection.size);
  if (!size) problems.push(`Size ${selection.size} không có cho món này`);
  else if (!size.available) problems.push(`Size ${selection.size} tạm hết`);

  const toppings: PricedSelection['toppings'] = [];
  for (const id of normalizeToppingIds(selection.toppingIds)) {
    const option = product.toppings.find((item) => item.topping.id.toLowerCase() === id);
    if (!option) {
      problems.push('Topping không thuộc món này');
      continue;
    }
    if (!option.available) problems.push(`${option.topping.name} tạm hết`);
    toppings.push({ id: option.topping.id, name: option.topping.name, extraPrice: option.extraPrice });
  }

  return {
    unitPrice: product.price + (size?.extraPrice ?? 0) + toppings.reduce((sum, item) => sum + item.extraPrice, 0),
    sizeName: size?.name ?? selection.size,
    toppings,
    problems,
  };
}

/** Như `priceSelection` nhưng từ chối (422) khi lựa chọn không hợp lệ. */
export function assertSelection(product: ProductDetailRecord, selection: CartSelection): PricedSelection {
  const priced = priceSelection(product, selection);
  if (priced.problems.length) throw new UnprocessableEntityException(priced.problems.join('; '));
  return priced;
}

export const stockMessage = (product: Pick<ProductDetailRecord, 'name' | 'stock'>) =>
  product.stock === 0 ? `${product.name} đang hết hàng` : `${product.name} chỉ còn ${product.stock} phần`;
