import { jest } from '@jest/globals';
import { LoyaltyService } from './loyalty.service';

describe('LoyaltyService - Vouchers and Points Redemption', () => {
  let loyaltyService: LoyaltyService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      voucher: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(mockPrisma)),
    };
    loyaltyService = new LoyaltyService(mockPrisma);
  });

  describe('redeemReward', () => {
    it('rejects invalid or missing rewardId', async () => {
      await expect(loyaltyService.redeemReward('user-1', 'invalid-reward')).rejects.toThrow(
        'Gói đổi thưởng không tồn tại trên hệ thống',
      );
    });

    it('rejects when user has insufficient loyalty points', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(loyaltyService.redeemReward('user-1', 'rw-10k')).rejects.toThrow(
        'Điểm tích lũy không đủ để đổi ưu đãi này.',
      );
      expect(mockPrisma.voucher.create).not.toHaveBeenCalled();
    });

    it('successfully redeems rewardId (rw-10k: 50 points -> 10.000đ), creating AVAILABLE voucher for user', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.voucher.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'voucher-1',
          ...args.data,
        }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ loyaltyPoints: 50 });

      const res = await loyaltyService.redeemReward('user-1', 'rw-10k');

      expect(res.success).toBe(true);
      expect(res.discountAmount).toBe(10000);
      expect(res.minOrderValue).toBe(0);
      expect(res.remainingPoints).toBe(50);
      expect(res.code).toMatch(/^REDEEM-50P-[A-F0-9]{8}$/);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', loyaltyPoints: { gte: 50 } },
        data: { loyaltyPoints: { decrement: 50 } },
      });

      expect(mockPrisma.voucher.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          rewardId: 'rw-10k',
          discountAmount: 10000,
          minOrderValue: 0,
          status: 'AVAILABLE',
        }),
      });
    });

    it('successfully redeems rw-50k (200 points -> 50.000đ for min order 100.000đ)', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.voucher.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'voucher-2',
          ...args.data,
        }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ loyaltyPoints: 10 });

      const res = await loyaltyService.redeemReward('user-1', 'rw-50k');

      expect(res.success).toBe(true);
      expect(res.discountAmount).toBe(50000);
      expect(res.minOrderValue).toBe(100000);
      expect(res.code).toMatch(/^REDEEM-200P-[A-F0-9]{8}$/);
    });

    it('concurrency safety: two simultaneous redeem requests with points for only one will have exactly one success', async () => {
      let currentPoints = 50; // Only enough for one 50-point voucher
      mockPrisma.user.updateMany.mockImplementation((args: any) => {
        if (currentPoints >= args.where.loyaltyPoints.gte) {
          currentPoints -= args.data.loyaltyPoints.decrement;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      });
      mockPrisma.voucher.create.mockResolvedValue({ id: 'voucher-1', code: 'REDEEM-50P-TEST' });
      mockPrisma.user.findUnique.mockImplementation(() => Promise.resolve({ loyaltyPoints: currentPoints }));

      const req1 = loyaltyService.redeemReward('user-1', 'rw-10k');
      const req2 = loyaltyService.redeemReward('user-1', 'rw-10k');

      const results = await Promise.allSettled([req1, req2]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(currentPoints).toBe(0);
    });
  });

  describe('getAvailableVouchers', () => {
    it('retrieves only AVAILABLE vouchers owned by the user from PostgreSQL', async () => {
      const mockVouchers = [
        {
          id: 'v-1',
          code: 'REDEEM-50P-ABCD',
          title: 'Voucher Giảm 10.000đ',
          description: 'Mô tả',
          discountAmount: 10000,
          minOrderValue: 0,
          status: 'AVAILABLE',
          createdAt: new Date('2026-10-29T00:00:00Z'),
        },
      ];
      mockPrisma.voucher.findMany.mockResolvedValue(mockVouchers);

      const list = await loyaltyService.getAvailableVouchers('user-1');

      expect(mockPrisma.voucher.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'AVAILABLE' },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
      expect(list).toHaveLength(1);
      expect(list[0].code).toBe('REDEEM-50P-ABCD');
      expect(list[0].isUsed).toBe(false);
    });
  });
});

