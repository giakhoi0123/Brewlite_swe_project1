import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { assertOrderTransition } from './order-state-machine';
import { ORDER_DISCOUNT, type OrderDiscount } from './order-discount';
import { orderInclude, orderResponse } from './order-response';

function money(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) {
    throw new BadRequestException('Giá trị đơn hàng vượt giới hạn');
  }
  return value;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(ORDER_DISCOUNT) private readonly discount: OrderDiscount,
  ) {}

  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(work);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Đơn hàng hoặc tồn kho vừa thay đổi. Vui lòng thử lại',
        );
      }
      throw error;
    }
  }

  async create(userId: string, dto: CreateOrderDto) {
    if (!dto.items?.length) throw new BadRequestException('Giỏ hàng trống');
    return this.transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: [...new Set(dto.items.map((i) => i.productId))] } },
        include: { sizes: true, toppings: { include: { topping: true } } },
      });
      const items = dto.items.map((item, position) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) throw new BadRequestException('Sản phẩm không tồn tại');
        const size = product.sizes.find(
          (s) => s.code === item.size && s.available,
        );
        if (!size)
          throw new BadRequestException('Size không hợp lệ hoặc ngừng bán');
        if (new Set(item.toppingIds).size !== item.toppingIds.length) {
          throw new BadRequestException('Topping bị trùng');
        }
        const toppings = item.toppingIds.map((id) => {
          const option = product.toppings.find(
            (t) => t.toppingId === id && t.available,
          );
          if (!option)
            throw new BadRequestException(
              'Topping không hợp lệ hoặc ngừng bán',
            );
          return {
            toppingId: id,
            name: option.topping.name,
            extraPrice: money(option.extraPrice),
          };
        });
        const unitPrice = money(
          money(product.price) +
            money(size.extraPrice) +
            toppings.reduce((sum, t) => sum + t.extraPrice, 0),
        );
        if (
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 99
        ) {
          throw new BadRequestException('Số lượng không hợp lệ');
        }
        return {
          productId: product.id,
          position,
          name: product.name,
          imageUrl: product.imageUrl,
          size: size.code,
          basePrice: product.price,
          sizePrice: size.extraPrice,
          unitPrice,
          qty: item.quantity,
          lineTotal: money(unitPrice * item.quantity),
          ice: item.ice,
          sugar: item.sugar,
          note: item.note?.trim() || null,
          toppings: { create: toppings },
        };
      });
      const subtotal = money(
        items.reduce((sum, item) => sum + item.lineTotal, 0),
      );
      const promotionCode = dto.promotionCode?.trim();
      if (dto.promotionCode != null && !promotionCode)
        throw new BadRequestException('Mã ưu đãi trống');
      const discountAmount = money(
        await this.discount.calculate(tx, { userId, subtotal, promotionCode }),
      );
      if (discountAmount > subtotal)
        throw new BadRequestException('Giảm giá vượt tổng đơn');
      await this.inventory.reserve(tx, items, products);
      const order = await tx.order.create({
        data: {
          userId,
          subtotal,
          discountAmount,
          total: subtotal - discountAmount,
          promotionCode,
          status: OrderStatus.PENDING,
          inventoryHeld: true,
          items: { create: items },
          statusHistory: { create: { toStatus: OrderStatus.PENDING, version: 1 } },
        } satisfies Prisma.OrderUncheckedCreateInput,
        include: orderInclude,
      });
      return orderResponse(order);
    });
  }

  async mine(userId: string) {
    return (
      await this.prisma.order.findMany({
        where: { userId },
        include: orderInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map(orderResponse);
  }

  async get(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return orderResponse(order);
  }

  /** Internal payment retry only. Re-reserves inventory atomically and verifies ownership. */
  async preparePaymentRetry(
    id: string,
    userId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const prepare = async (tx: Prisma.TransactionClient) => {
      const owned = await tx.order.findFirst({ where: { id, userId } });
      if (!owned) throw new NotFoundException('Không tìm thấy đơn hàng');
      return orderResponse(
        await this.transitionInTransaction(tx, id, OrderStatus.PENDING),
      );
    };
    return transaction ? prepare(transaction) : this.transaction(prepare);
  }

  async staffList() {
    return (
      await this.prisma.order.findMany({
        where: { status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] } },
        include: orderInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    ).map(orderResponse);
  }

  async staffTransition(id: string, to: OrderStatus) {
    if (
      !(
        ['PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as OrderStatus[]
      ).includes(to)
    ) {
      throw new BadRequestException('Barista không được xác nhận thanh toán');
    }
    return this.transaction(async (tx) =>
      orderResponse(await this.transitionInTransaction(tx, id, to)),
    );
  }

  async staffCancel(id: string, reason: string) {
    const trimmed = reason.trim();
    if (!trimmed) throw new BadRequestException('Cần ghi lý do hủy đơn');
    return this.transaction(async (tx) =>
      orderResponse(await this.transitionInTransaction(tx, id, OrderStatus.CANCELLED, trimmed)),
    );
  }

  /** Internal TV5/TV6 integration only. Caller MUST propagate errors to roll back its transaction.
   * Verify ownership in PaymentsModule; persist payment/idempotency/loyalty in the same tx.
   * UNKNOWN must not call this method. Retry PAYMENT_FAILED -> PENDING before gateway attempt.
   */
  async transitionInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    to: OrderStatus,
    cancelReason?: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    assertOrderTransition(order.status, to);
    const release =
      to === OrderStatus.CANCELLED || to === OrderStatus.PAYMENT_FAILED;
    const reserve =
      order.status === OrderStatus.PAYMENT_FAILED && to === OrderStatus.PENDING;
    // Version also prevents ABA races across PAYMENT_FAILED -> PENDING retry cycles.
    const changed = await tx.order.updateMany({
      where: { id, status: order.status, version: order.version },
      data: {
        status: to,
        version: { increment: 1 },
        inventoryHeld: release ? false : reserve ? true : order.inventoryHeld,
        ...(to === OrderStatus.CANCELLED && cancelReason ? { cancelReason } : {}),
      },
    });
    if (changed.count !== 1)
      throw new ConflictException('Đơn hàng vừa thay đổi. Vui lòng tải lại');
    if (release && order.inventoryHeld)
      await this.inventory.restore(tx, order.items);
    if (reserve) await this.inventory.reserve(tx, order.items);
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: to,
        version: order.version + 1,
      },
    });
    return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  }
}
