import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import type { ProductDetailRecord } from './product-detail';
import type { CreateOrderItemDto } from '../orders/dto/create-order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { cartConfigKey, normalizeToppingIds } from '../cart/cart-pricing';

export type MissingIngredientDetail = {
  ingredientId: string;
  name: string;
  unit: string;
  stock: number;
  required: number;
  shortage: number;
};

export type PreviewSelectionResult = {
  valid: boolean;
  canAddOne: boolean;
  maxAvailable: number;
  currentShortages: MissingIngredientDetail[];
  nextShortages: MissingIngredientDetail[];
  reason?: 'MAX_REACHED' | 'SHORTAGE' | 'UNAVAILABLE' | 'INVALID_RECIPE' | 'INVALID_SELECTION';
};

export function evaluateSelectionPreview(
  candidate: CreateOrderItemDto,
  cartItems: CreateOrderItemDto[] = [],
  products: ProductDetailRecord[],
  ingredients: Map<string, { id: string; name: string; unit: string; stock: Prisma.Decimal }>,
): PreviewSelectionResult {
  const product = products.find((p) => p.id === candidate.productId);
  if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');

  const sizeOption = product.sizes.find((s) => s.code === candidate.size);
  if (!sizeOption || !sizeOption.available) {
    return {
      valid: false,
      canAddOne: false,
      maxAvailable: 0,
      currentShortages: [],
      nextShortages: [],
      reason: 'UNAVAILABLE',
    };
  }

  const normalizedToppings = normalizeToppingIds(candidate.toppingIds);
  for (const tId of normalizedToppings) {
    const tOpt = product.toppings.find((t) => t.topping.id === tId);
    if (!tOpt || !tOpt.available) {
      return {
        valid: false,
        canAddOne: false,
        maxAvailable: 0,
        currentShortages: [],
        nextShortages: [],
        reason: 'INVALID_SELECTION',
      };
    }
  }

  // Validate candidate base recipe and topping recipes
  if (!sizeOption.recipe?.length) {
    return {
      valid: false,
      canAddOne: false,
      maxAvailable: 0,
      currentShortages: [],
      nextShortages: [],
      reason: 'INVALID_RECIPE',
    };
  }
  for (const row of sizeOption.recipe) {
    if (!row.amount.isFinite() || row.amount.lte(0)) {
      return {
        valid: false,
        canAddOne: false,
        maxAvailable: 0,
        currentShortages: [],
        nextShortages: [],
        reason: 'INVALID_RECIPE',
      };
    }
  }
  for (const tId of normalizedToppings) {
    const tOpt = product.toppings.find((t) => t.topping.id === tId);
    if (!tOpt?.topping.recipe?.length) {
      return {
        valid: false,
        canAddOne: false,
        maxAvailable: 0,
        currentShortages: [],
        nextShortages: [],
        reason: 'INVALID_RECIPE',
      };
    }
    for (const row of tOpt.topping.recipe) {
      if (!row.amount.isFinite() || row.amount.lte(0)) {
        return {
          valid: false,
          canAddOne: false,
          maxAvailable: 0,
          currentShortages: [],
          nextShortages: [],
          reason: 'INVALID_RECIPE',
        };
      }
    }
  }

  // Candidate unit demand (1 cup)
  const candidateUnitDemand = new Map<string, Prisma.Decimal>();
  for (const row of sizeOption.recipe) {
    const prev = candidateUnitDemand.get(row.ingredientId) ?? new Prisma.Decimal(0);
    candidateUnitDemand.set(row.ingredientId, prev.plus(row.amount));
  }
  for (const tId of normalizedToppings) {
    const tOpt = product.toppings.find((t) => t.topping.id === tId);
    for (const row of tOpt?.topping.recipe ?? []) {
      const prev = candidateUnitDemand.get(row.ingredientId) ?? new Prisma.Decimal(0);
      candidateUnitDemand.set(row.ingredientId, prev.plus(row.amount));
    }
  }

  // Identify matching cart item (if any) and other cart items
  const candidateConfigKey = cartConfigKey({
    size: candidate.size,
    toppingIds: candidate.toppingIds,
    ice: candidate.ice,
    sugar: candidate.sugar,
    note: candidate.note ?? '',
  });

  let existingMatchingQuantity = 0;
  const otherCartItems: CreateOrderItemDto[] = [];

  for (const item of cartItems) {
    const itemKey = cartConfigKey({
      size: item.size,
      toppingIds: item.toppingIds,
      ice: item.ice,
      sugar: item.sugar,
      note: item.note ?? '',
    });
    if (item.productId === candidate.productId && itemKey === candidateConfigKey) {
      existingMatchingQuantity += item.quantity;
    } else {
      otherCartItems.push(item);
    }
  }

  // Demand of other cart items
  const otherCartDemand = new Map<string, Prisma.Decimal>();
  if (otherCartItems.length > 0) {
    const otherUsage = new InventoryService().demand(
      otherCartItems,
      products.map((p) => ({
        ...p,
        toppings: p.toppings.map((t) => ({ ...t, toppingId: t.topping.id })),
      })),
    );
    for (const u of otherUsage) {
      otherCartDemand.set(u.ingredientId, u.amount);
    }
  }

  // Calculate max cups supported by each ingredient
  let maxCupsAcrossIngredients = 99;
  for (const [ingredientId, unitAmt] of candidateUnitDemand) {
    const ing = ingredients.get(ingredientId);
    const stock = ing && ing.stock.isFinite() && ing.stock.gte(0) ? ing.stock : new Prisma.Decimal(0);
    const otherDemand = otherCartDemand.get(ingredientId) ?? new Prisma.Decimal(0);
    const availForCandidate = Prisma.Decimal.max(0, stock.minus(otherDemand));
    const cups = availForCandidate.div(unitAmt).floor().toNumber();
    if (cups < maxCupsAcrossIngredients) {
      maxCupsAcrossIngredients = cups;
    }
  }

  // Max additional quantity candidate can add
  const maxTotalLine = Math.min(99, Math.max(0, maxCupsAcrossIngredients));
  const maxAvailable = Math.max(0, Math.min(99 - existingMatchingQuantity, maxTotalLine - existingMatchingQuantity));

  // Current selection check
  const proposedMergedQty = existingMatchingQuantity + candidate.quantity;
  const currentShortages: MissingIngredientDetail[] = [];
  let currentReason: PreviewSelectionResult['reason'];

  if (proposedMergedQty > 99) {
    currentReason = 'MAX_REACHED';
  }

  for (const [ingredientId, unitAmt] of candidateUnitDemand) {
    const ing = ingredients.get(ingredientId);
    const stock = ing && ing.stock.isFinite() && ing.stock.gte(0) ? ing.stock : new Prisma.Decimal(0);
    const otherDemand = otherCartDemand.get(ingredientId) ?? new Prisma.Decimal(0);
    const required = otherDemand.plus(unitAmt.mul(proposedMergedQty));
    if (required.gt(stock)) {
      currentShortages.push({
        ingredientId,
        name: ing?.name ?? 'Nguyên liệu',
        unit: ing?.unit ?? '',
        stock: stock.toNumber(),
        required: required.toNumber(),
        shortage: required.minus(stock).toNumber(),
      });
    }
  }

  const valid = proposedMergedQty <= 99 && currentShortages.length === 0;
  if (!valid && !currentReason) {
    currentReason = currentShortages.length > 0 ? 'SHORTAGE' : 'INVALID_SELECTION';
  }

  // Next cup check (candidate.quantity + 1)
  const nextMergedQty = existingMatchingQuantity + candidate.quantity + 1;
  const nextShortages: MissingIngredientDetail[] = [];
  let nextReason: PreviewSelectionResult['reason'];

  if (nextMergedQty > 99) {
    nextReason = 'MAX_REACHED';
  }

  for (const [ingredientId, unitAmt] of candidateUnitDemand) {
    const ing = ingredients.get(ingredientId);
    const stock = ing && ing.stock.isFinite() && ing.stock.gte(0) ? ing.stock : new Prisma.Decimal(0);
    const otherDemand = otherCartDemand.get(ingredientId) ?? new Prisma.Decimal(0);
    const required = otherDemand.plus(unitAmt.mul(nextMergedQty));
    if (required.gt(stock)) {
      nextShortages.push({
        ingredientId,
        name: ing?.name ?? 'Nguyên liệu',
        unit: ing?.unit ?? '',
        stock: stock.toNumber(),
        required: required.toNumber(),
        shortage: required.minus(stock).toNumber(),
      });
    }
  }

  const canAddOne = nextMergedQty <= 99 && nextShortages.length === 0;
  if (!canAddOne && !nextReason) {
    nextReason = nextShortages.length > 0 ? 'SHORTAGE' : 'INVALID_SELECTION';
  }

  return {
    valid,
    canAddOne,
    maxAvailable,
    currentShortages,
    nextShortages,
    reason: valid ? (canAddOne ? undefined : nextReason) : currentReason,
  };
}

