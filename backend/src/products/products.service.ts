import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Product } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { productDetailSelect, type ProductDetail } from './product-detail';
import { recipeCapacity } from '../inventory/recipe-capacity';

export type ProductListItem = Pick<Product, 'id' | 'name' | 'price' | 'imageUrl' | 'stock' | 'description'>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ProductListItem[]> {
    const products = await this.prisma.product.findMany({
      select: { id: true, name: true, price: true, imageUrl: true, stock: true, description: true,
        sizes: { select: { available: true, recipe: { include: { ingredient: true } } } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return products.map(({ sizes, ...product }) => ({ ...product,
      stock: Math.min(product.stock, Math.max(0, ...sizes.filter((s) => s.available).map((s) => recipeCapacity(s.recipe)))) }));
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
      id: size.id, code: size.code, name: size.name, extraPrice: size.extraPrice,
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
      stock: Math.min(product.stock, Math.max(0, ...product.sizes.filter((s) => s.available).map((s) => recipeCapacity(s.recipe)))),
      sizes,
      toppings: product.toppings.map(({ topping, extraPrice, available }) => ({ id: topping.id, name: topping.name, extraPrice, available: available && recipeCapacity(topping.recipe) > 0 })),
      defaultSizeId: defaultSize.id,
    };
  }
}
