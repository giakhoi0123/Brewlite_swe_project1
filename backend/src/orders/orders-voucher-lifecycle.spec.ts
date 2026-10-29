import { jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService - Voucher Lifecycle, Concurrency & Customer Cancellation', () => {
  let ordersService: OrdersService;
  let mockPrisma: any;
  let mockInventory: any;
  let mockDiscount: any;

  beforeEach(() => {
    mockInventory = {
      demand: jest.fn().mockReturnValue([]),
      reserve: jest.fn().mockResolvedValue(undefined as never),
      reserveIngredients: jest.fn().mockResolvedValue(undefined as never),
      restore: jest.fn().mockResolvedValue(undefined as never),
      restoreIngredients: jest.fn().mockResolvedValue(undefined as never),
    };
    mockDiscount = {
      calculate: jest.fn().mockResolvedValue(10000 as never),
    };
    mockPrisma = {
      product: {
        findMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      voucher: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      promotion: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      loyaltyLog: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(mockPrisma)),
    };

    ordersService = new OrdersService(mockPrisma, mockInventory, mockDiscount);
  });

  describe('create order with personal voucher', () => {
    it('atomically reserves the voucher (AVAILABLE -> RESERVED) linked to order', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Cà phê Đen',
        price: 35000,
        imageUrl: '/img.png',
        sizes: [{ code: 'M', extraPrice: 0, available: true, recipe: [] }],
        toppings: [],
      };
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.voucher.findUnique.mockResolvedValue({
        id: 'voucher-1',
        code: 'REDEEM-50P-TEST',
        userId: 'user-1',
        status: 'AVAILABLE',
      });
      mockPrisma.voucher.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.order.create.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        user: { fullName: 'Customer' },
        status: OrderStatus.PENDING,
        version: 1,
        subtotal: 35000,
        discountAmount: 10000,
        total: 25000,
        promotionCode: 'REDEEM-50P-TEST',
        createdAt: new Date(),
        items: [],
        statusHistory: [],
      });

      const res = await ordersService.create('user-1', {
        items: [
          {
            productId: 'prod-1',
            size: 'M' as any,
            toppingIds: [],
            quantity: 1,
            ice: '100% đá',
            sugar: '100% chuẩn',
          },
        ],
        promotionCode: 'REDEEM-50P-TEST',
      });

      expect(res.id).toBe('order-1');
      expect(mockPrisma.voucher.updateMany).toHaveBeenCalledWith({
        where: { id: 'voucher-1', status: 'AVAILABLE', userId: 'user-1' },
        data: expect.objectContaining({
          status: 'RESERVED',
          orderId: 'order-1',
        }),
      });
    });

    it('rejects with ConflictException if voucher is already reserved or used (concurrency race)', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Cà phê Đen',
        price: 35000,
        imageUrl: '/img.png',
        sizes: [{ code: 'M', extraPrice: 0, available: true, recipe: [] }],
        toppings: [],
      };
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.voucher.findUnique.mockResolvedValue({
        id: 'voucher-1',
        code: 'REDEEM-50P-TEST',
        userId: 'user-1',
        status: 'AVAILABLE',
      });
      mockPrisma.order.create.mockResolvedValue({ id: 'order-2', items: [], statusHistory: [] });
      // updateMany returns count 0 because another concurrent tx already reserved it
      mockPrisma.voucher.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        ordersService.create('user-1', {
          items: [
            {
              productId: 'prod-1',
              size: 'M' as any,
              toppingIds: [],
              quantity: 1,
              ice: '100% đá',
              sugar: '100% chuẩn',
            },
          ],
          promotionCode: 'REDEEM-50P-TEST',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transitionInTransaction: voucher lifecycle & loyalty reversal', () => {
    it('marks voucher as REDEEMED when order transitions to PAID', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        version: 1,
        total: 50000,
        inventoryHeld: true,
        items: [],
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue({ ...mockOrder, status: OrderStatus.PAID, version: 2 });
      mockPrisma.loyaltyLog.findUnique.mockResolvedValue(null);

      await ordersService.transitionInTransaction(mockPrisma, 'order-1', OrderStatus.PAID);

      expect(mockPrisma.voucher.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1', status: 'RESERVED' },
        data: expect.objectContaining({ status: 'REDEEMED' }),
      });
    });

    it('releases voucher back to AVAILABLE when order payment fails or order is cancelled', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        version: 1,
        total: 50000,
        inventoryHeld: true,
        items: [],
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue({ ...mockOrder, status: OrderStatus.CANCELLED, version: 2 });

      await ordersService.transitionInTransaction(
        mockPrisma,
        'order-1',
        OrderStatus.CANCELLED,
        'Khách hàng tự hủy đơn',
      );

      expect(mockPrisma.voucher.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1', status: { in: ['RESERVED', 'REDEEMED'] } },
        data: {
          status: 'AVAILABLE',
          orderId: null,
          reservedAt: null,
          redeemedAt: null,
        },
      });
    });
  });

  describe('customerCancel', () => {
    it('allows customer to cancel PENDING order and verifies ownership', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        version: 1,
        total: 30000,
        inventoryHeld: true,
        items: [],
      };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        user: { fullName: 'Customer' },
        status: OrderStatus.CANCELLED,
        version: 2,
        createdAt: new Date(),
        statusHistory: [],
      });

      const res = await ordersService.customerCancel('order-1', 'user-1', 'Đổi ý không mua nữa');

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-1', userId: 'user-1' },
      });
      expect(res.status).toBe(OrderStatus.CANCELLED);
    });

    it('forbids customer from cancelling PREPARING, READY, or COMPLETED orders', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PREPARING,
        version: 1,
      };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(
        ordersService.customerCancel('order-1', 'user-1'),
      ).rejects.toThrow('Chỉ có thể hủy đơn hàng đang chờ thanh toán hoặc thanh toán thất bại');
    });

    it('throws NotFoundException if customer does not own the order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        ordersService.customerCancel('order-99', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
