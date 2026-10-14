import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Product } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { productDetailSelect, type ProductDetail } from './product-detail';

export type ProductListItem = Pick<Product, 'id' | 'name' | 'price' | 'imageUrl' | 'stock' | 'description'>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<ProductListItem[]> {
    return this.prisma.product.findMany({
      select: { id: true, name: true, price: true, imageUrl: true, stock: true, description: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
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

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price,
      stock: product.stock,
      sizes: product.sizes.map((size) => ({
        id: size.id, code: size.code, name: size.name, extraPrice: size.extraPrice, available: size.available,
      })),
      toppings: product.toppings.map(({ topping, extraPrice, available }) => ({ ...topping, extraPrice, available })),
      defaultSizeId: defaults[0].id,
    };
  }
}
