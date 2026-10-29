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
        include: {
          sizes: { include: { recipe: true } },
          toppings: { include: { topping: { include: { recipe: true } } } },
        },
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
      const ingredientUsage = this.inventory.demand(dto.items, products);
      await this.inventory.reserve(tx, items, products);
      await this.inventory.reserveIngredients(tx, ingredientUsage);
      const order = await tx.order.create({
        data: {
          userId,
          subtotal,
          discountAmount,
          total: subtotal - discountAmount,
          promotionCode,
          status: OrderStatus.PENDING,
          inventoryHeld: true,
          ingredientInventory: true,
          ingredientUsage: { create: ingredientUsage },
          items: { create: items },
          statusHistory: {
            create: { toStatus: OrderStatus.PENDING, version: 1 },
          },
        } satisfies Prisma.OrderUncheckedCreateInput,
        include: orderInclude,
      });

      // ĐÁNH DẤU MÃ VOUCHER ĐÃ ĐƯỢC SỬ DỤNG VÀ TĂNG LỢT SỬ DỤNG NGUYÊN TỬ
      if (promotionCode) {
        // 1. Kiểm tra nếu là Voucher cá nhân
        const voucher = await tx.voucher.findUnique({
          where: { code: promotionCode },
        });

        if (voucher) {
          if (voucher.userId !== userId) {
            throw new BadRequestException('Mã ưu đãi này không thuộc tài khoản của bạn');
          }
          // Chuyển trạng thái voucher sang RESERVED một cách nguyên tử
          const reserved = await tx.voucher.updateMany({
            where: { id: voucher.id, status: 'AVAILABLE', userId },
            data: {
              status: 'RESERVED',
              orderId: order.id,
              reservedAt: new Date(),
            },
          });
          if (reserved.count !== 1) {
            throw new ConflictException('Mã ưu đãi đã được sử dụng hoặc đang trong đơn hàng khác');
          }
        } else {
          // 2. Nếu là mã Promotion chung
          const promo = await tx.promotion.findUnique({
            where: { code: promotionCode },
          });
          if (promo) {
            await tx.promotion.update({
              where: { id: promo.id },
              data: { usageCount: { increment: 1 } },
            });
          }
        }
      }

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
        where: {
          status: {
            in: ['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
          },
        },
        include: orderInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    ).map(orderResponse);
  }

  async staffGet(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return orderResponse(order);
  }

  async staffCancel(id: string, reason: string) {
    return this.transaction(async (tx) =>
      orderResponse(
        await this.transitionInTransaction(
          tx,
          id,
          OrderStatus.CANCELLED,
          reason,
        ),
      ),
    );
  }

  async staffTransition(id: string, to: OrderStatus) {
    if (!(['PREPARING', 'READY', 'COMPLETED'] as OrderStatus[]).includes(to)) {
      throw new BadRequestException(
        'Chỉ cho phép PREPARING, READY hoặc COMPLETED; hủy đơn phải dùng API cancel kèm lý do',
      );
    }
    return this.transaction(async (tx) =>
      orderResponse(await this.transitionInTransaction(tx, id, to)),
    );
  }

  /** Internal TV5/TV6 integration only. Caller MUST propagate errors to roll back its transaction.
   * Verify ownership in PaymentsModule; persist payment/idempotency/loyalty in the same tx.
   * UNKNOWN must not call this method. Retry PAYMENT_FAILED -> PENDING before gateway attempt.
   * CANCELLED requires a reason as the fourth argument, including internal callers.
   */
  async transitionInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    to: OrderStatus,
    reason?: string,
  ) {
    const cancelReason = typeof reason === 'string' ? reason.trim() : '';
    if (
      to === OrderStatus.CANCELLED &&
      (!cancelReason || Array.from(cancelReason).length > 300)
    ) {
      throw new BadRequestException('Lý do hủy phải có từ 1 đến 300 ký tự');
    }
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
    const transitionedAt = new Date();
    // Version also prevents ABA races across PAYMENT_FAILED -> PENDING retry cycles.
    const changed = await tx.order.updateMany({
      where: { id, status: order.status, version: order.version },
      data: {
        status: to,
        version: { increment: 1 },
        inventoryHeld: release ? false : reserve ? true : order.inventoryHeld,
        ...(to === OrderStatus.CANCELLED ? { cancelReason } : {}),
        ...(to === OrderStatus.COMPLETED
          ? { completedAt: transitionedAt }
          : {}),
      },
    });
    if (changed.count !== 1)
      throw new ConflictException('Đơn hàng vừa thay đổi. Vui lòng tải lại');
    if (release && order.inventoryHeld) {
      await this.inventory.restore(tx, order.items);
      // A drink already being prepared cannot return its ingredients to usable stock.
      if (order.ingredientInventory && order.status !== OrderStatus.PREPARING)
        await this.inventory.restoreIngredients(tx, order.ingredientUsage);
    }
    if (release && tx.voucher) {
      await tx.voucher.updateMany({
        where: { orderId: id, status: { in: ['RESERVED', 'REDEEMED'] } },
        data: {
          status: 'AVAILABLE',
          orderId: null,
          reservedAt: null,
          redeemedAt: null,
        },
      });

      if (
        (order.status === OrderStatus.PAID ||
          order.status === OrderStatus.PREPARING) &&
        tx.loyaltyLog
      ) {
        const log = await tx.loyaltyLog.findUnique({ where: { orderId: id } });
        if (log) {
          await tx.user.update({
            where: { id: order.userId },
            data: { loyaltyPoints: { decrement: log.points } },
          });
          await tx.loyaltyLog.delete({ where: { id: log.id } });
        }
      }
    }
    if (reserve) {
      await this.inventory.reserve(tx, order.items);
      if (order.ingredientInventory)
        await this.inventory.reserveIngredients(tx, order.ingredientUsage);

      if (order.promotionCode && tx.voucher) {
        await tx.voucher.updateMany({
          where: {
            code: order.promotionCode,
            userId: order.userId,
            status: 'AVAILABLE',
          },
          data: { status: 'RESERVED', orderId: id, reservedAt: transitionedAt },
        });
      }
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: to,
        version: order.version + 1,
        createdAt: transitionedAt,
      },
    });

    if (to === OrderStatus.PAID && order.status !== OrderStatus.PAID) {
      if (tx.voucher) {
        await tx.voucher.updateMany({
          where: { orderId: id, status: 'RESERVED' },
          data: { status: 'REDEEMED', redeemedAt: transitionedAt },
        });
      }

      const pointsToEarn = Math.floor(order.total / 10000);
      if (pointsToEarn > 0 && tx.user) {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPoints: {
              increment: pointsToEarn,
            },
          },
        });
        if (tx.loyaltyLog) {
          const existingLog = await tx.loyaltyLog.findUnique({
            where: { orderId: id },
          });
          if (!existingLog) {
            await tx.loyaltyLog.create({
              data: {
                userId: order.userId,
                orderId: id,
                points: pointsToEarn,
              },
            });
          }
        }
      }
    }

    return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  }

  async customerCancel(id: string, userId: string, reason?: string) {
    return this.transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, userId },
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.PAYMENT_FAILED
      ) {
        throw new BadRequestException(
          'Chỉ có thể hủy đơn hàng đang chờ thanh toán hoặc thanh toán thất bại',
        );
      }
      const cancelReason = (reason || 'Khách hàng tự hủy đơn').trim();
      return orderResponse(
        await this.transitionInTransaction(
          tx,
          id,
          OrderStatus.CANCELLED,
          cancelReason,
        ),
      );
    });
  }
}
