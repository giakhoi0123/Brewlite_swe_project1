import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ProductSizeCode } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { productDetailSelect } from '../products/product-detail';
import {
  MAX_LINE_QUANTITY,
  assertSelection,
  cartConfigKey,
  normalizeToppingIds,
  priceSelection,
} from './cart-pricing';
import type { CartLineDto, MergeCartDto, UpdateCartItemDto } from './dto/cart-line.dto';
import { assertCartAvailability } from '../inventory/cart-availability';

const itemInclude = { product: { select: productDetailSelect } } satisfies Prisma.CartItemInclude;
type CartItemRecord = Prisma.CartItemGetPayload<{ include: typeof itemInclude }>;
type Tx = Prisma.TransactionClient;
type QuantityRow = { id: string; configKey: string; quantity: number };

export type CartItemView = {
  id: string;
  productId: string;
  name: string;
  imageUrl: string;
  size: ProductSizeCode;
  sizeName: string;
  sizeOptions: { code: ProductSizeCode; name: string; extraPrice: number; available: boolean }[];
  toppingIds: string[];
  toppingNames: string[];
  ice: string;
  sugar: string;
  note: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  available: boolean;
  issue?: string;
};
export type CartView = { items: CartItemView[]; totalQuantity: number; subtotal: number; valid: boolean };
export type MergeResult = CartView & { skipped: { productId: string; reason: string }[] };

const sum = (rows: { quantity: number }[]) => rows.reduce((total, row) => total + row.quantity, 0);

export function toCartView(items: CartItemRecord[]): CartView {
  let ingredientIssue = '';
  try { assertCartAvailability(items, items.map((i) => i.product)); }
  catch (error) {
    if (!(error instanceof HttpException)) throw error;
    ingredientIssue = error.message;
  }
  const views = items.map((item): CartItemView => {
    const priced = priceSelection(item.product, item);
    const problems = [...priced.problems];
    if (ingredientIssue) problems.push(ingredientIssue);
    return {
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      imageUrl: item.product.imageUrl,
      size: item.size,
      sizeName: priced.sizeName,
      sizeOptions: item.product.sizes.map(({ code, name, extraPrice, available }) => ({ code, name, extraPrice, available })),
      toppingIds: priced.toppings.map((topping) => topping.id),
      toppingNames: priced.toppings.map((topping) => topping.name),
      ice: item.ice,
      sugar: item.sugar,
      note: item.note,
      quantity: item.quantity,
      unitPrice: priced.unitPrice,
      lineTotal: priced.unitPrice * item.quantity,
      available: problems.length === 0,
      ...(problems.length ? { issue: [...new Set(problems)].join('; ') } : {}),
    };
  });
  return {
    items: views,
    totalQuantity: sum(views),
    subtotal: views.reduce((total, item) => total + item.lineTotal, 0),
    valid: views.every((item) => item.available),
  };
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<CartView> {
    const items = await this.prisma.cartItem.findMany({
      where: { cart: { userId } },
      include: itemInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return toCartView(items);
  }

  async add(userId: string, line: CartLineDto): Promise<CartView> {
    await this.addLine(userId, line);
    return this.get(userId);
  }

  async update(userId: string, itemId: string, input: UpdateCartItemDto): Promise<CartView> {
    if (input.quantity === undefined && input.size === undefined)
      throw new BadRequestException('Cần truyền quantity hoặc size');
    await this.transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, include: itemInclude });
      if (!item) throw new NotFoundException('Không tìm thấy món trong giỏ');
      const size = input.size ?? item.size;
      const quantity = input.quantity ?? item.quantity;
      if (size !== item.size) assertSelection(item.product, { size, toppingIds: item.toppingIds });
      const configKey = cartConfigKey({ ...item, size });
      const rows = await this.sameProductRows(tx, item.cartId, item.productId);
      const target = rows.find((row) => row.id !== item.id && row.configKey === configKey);
      if (target) {
        // Đổi size trùng với một dòng đã có: gộp vào dòng đó.
        const merged = Math.min(MAX_LINE_QUANTITY, target.quantity + quantity);
        await tx.cartItem.delete({ where: { id: item.id } });
        await tx.cartItem.update({ where: { id: target.id }, data: { quantity: merged } });
      } else {
        await tx.cartItem.update({ where: { id: item.id }, data: { size, configKey, quantity } });
      }
      // Reductions can repair a stale cart even when another line is still invalid.
      if (size !== item.size || quantity > item.quantity) await this.validateCart(tx, item.cartId);
    });
    return this.get(userId);
  }

  async remove(userId: string, itemId: string): Promise<CartView> {
    const { count } = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
    if (!count) throw new NotFoundException('Không tìm thấy món trong giỏ');
    return this.get(userId);
  }

  async clear(userId: string): Promise<CartView> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    return this.get(userId);
  }

  /** Gộp giỏ khách vãng lai vào giỏ tài khoản sau đăng nhập; dòng không hợp lệ được bỏ qua và báo lại. */
  async merge(userId: string, input: MergeCartDto): Promise<MergeResult> {
    const skipped: MergeResult['skipped'] = [];
    for (const line of input.items) {
      try {
        await this.addLine(userId, line);
      } catch (error) {
        if (!(error instanceof HttpException) || error.getStatus() >= 500) throw error;
        skipped.push({ productId: line.productId, reason: error.message });
      }
    }
    return { ...(await this.get(userId)), skipped };
  }

  private async addLine(userId: string, line: CartLineDto) {
    const product = await this.prisma.product.findUnique({ where: { id: line.productId }, select: productDetailSelect });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    const toppingIds = normalizeToppingIds(line.toppingIds);
    assertSelection(product, { size: line.size, toppingIds });
    const note = (line.note ?? '').trim();
    const configKey = cartConfigKey({ ...line, toppingIds, note });
    await this.transaction(async (tx) => {
      const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
      const rows = await this.sameProductRows(tx, cart.id, product.id);
      const existing = rows.find((row) => row.configKey === configKey);
      const quantity = Math.min(MAX_LINE_QUANTITY, (existing?.quantity ?? 0) + line.quantity);
      if (existing) await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } });
      else
        await tx.cartItem.create({
          data: { cartId: cart.id, productId: product.id, size: line.size, toppingIds, ice: line.ice, sugar: line.sugar, note, configKey, quantity },
        });
      await this.validateCart(tx, cart.id);
    });
  }

  private sameProductRows(tx: Tx, cartId: string, productId: string): Promise<QuantityRow[]> {
    return tx.cartItem.findMany({ where: { cartId, productId }, select: { id: true, configKey: true, quantity: true } });
  }

  private async validateCart(tx: Tx, cartId: string) {
    const items = await tx.cartItem.findMany({ where: { cartId }, include: itemInclude });
    assertCartAvailability(items, items.map((i) => i.product));
  }

  private async transaction(work: (tx: Tx) => Promise<void>) {
    try {
      await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // Hai yêu cầu đồng thời cùng tạo một cấu hình: báo client tải lại thay vì lỗi 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code))
        throw new ConflictException('Giỏ hàng vừa thay đổi, vui lòng thử lại');
      throw error;
    }
  }
}
