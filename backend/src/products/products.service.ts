import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Product } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { productDetailSelect, type ProductDetail } from './product-detail';
import { recipeCapacity } from '../inventory/recipe-capacity';
import { assertCartAvailability } from '../inventory/cart-availability';
import type { CreateOrderItemDto } from '../orders/dto/create-order.dto';
import { PreviewSelectionDto } from './dto/preview-selection.dto';
import { evaluateSelectionPreview } from './selection-preview';

export type ProductListItem = Pick<Product, 'id' | 'name' | 'price' | 'imageUrl' | 'stock' | 'description'>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCart(items: CreateOrderItemDto[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(items.map((item) => item.productId))] } },
      select: productDetailSelect,
    });
    assertCartAvailability(items, products);
    return { valid: true };
  }

  async previewSelection(dto: PreviewSelectionDto) {
    const productIds = [
      ...new Set([
        dto.candidate.productId,
        ...(dto.cartItems?.map((i) => i.productId) ?? []),
      ]),
    ];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: productDetailSelect,
    });
    const ingredientIds = new Set<string>();
    for (const p of products) {
      for (const s of p.sizes) for (const r of s.recipe) ingredientIds.add(r.ingredientId);
      for (const t of p.toppings) for (const r of t.topping.recipe) ingredientIds.add(r.ingredientId);
    }
    const ingredientRecords = await this.prisma.ingredient.findMany({
      where: { id: { in: [...ingredientIds] } },
    });
    const ingredients = new Map(ingredientRecords.map((i) => [i.id, i]));
    return evaluateSelectionPreview(dto.candidate, dto.cartItems ?? [], products, ingredients);
  }

  async findAll(): Promise<ProductListItem[]> {
    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        stock: true,
        description: true,
        sizes: { select: { available: true, recipe: { include: { ingredient: true } } } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return products.map(({ sizes, ...product }) => ({
      ...product,
      stock: Math.max(0, ...sizes.filter((s) => s.available).map((s) => recipeCapacity(s.recipe))),
    }));
  }

  async findOne(id: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({ where: { id }, select: productDetailSelect });
    if (!product) throw new NotFoundException('Product not found');

    const defaults = product.sizes.filter((size) => size.isDefault);
    if (
      product.sizes.length !== 3 || new Set(product.sizes.map((size) => size.code)).size !== 3 ||
      defaults.length !== 1 || !defaults[0].available ||
      product.sizes.some((size) => !Number.isInteger(size.extraPrice) || size.extraPrice < 0) ||
      product.toppings.some((option) => !Number.isInteger(option.extraPrice) || option.extraPrice < 0)
    ) {
      // Existing products without configuration are a server data error, never a fake 404/default.
      throw new InternalServerErrorException();
    }

    const sizes = product.sizes.map((size) => ({
      id: size.id,
      code: size.code,
      name: size.name,
      extraPrice: size.extraPrice,
      stock: size.available ? Math.max(0, recipeCapacity(size.recipe)) : 0,
      available: size.available && recipeCapacity(size.recipe) > 0,
    }));
    const defaultSize = sizes.find((s) => s.id === defaults[0].id && s.available)
      ?? sizes.find((s) => s.available) ?? sizes.find((s) => s.id === defaults[0].id)!;
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price,
      stock: Math.max(0, ...sizes.map((s) => s.stock)),
      sizes,
      toppings: product.toppings.map(({ topping, extraPrice, available }) => ({
        id: topping.id,
        name: topping.name,
        extraPrice,
        available: available && recipeCapacity(topping.recipe) > 0,
      })),
      defaultSizeId: defaultSize.id,
    };
  }
}
