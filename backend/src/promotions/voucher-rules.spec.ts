import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { resolveVoucher } from './voucher-rules';

describe('voucher-rules: resolveVoucher', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      voucher: {
        findUnique: jest.fn(),
      },
      promotion: {
        findFirst: jest.fn(),
      },
    };
  });

  it('returns 0 discount for empty code', async () => {
    const res = await resolveVoucher('', 100000, mockPrisma);
    expect(res.discountAmount).toBe(0);
    expect(res.valid).toBe(true);
  });

  describe('Personal Vouchers (Voucher table)', () => {
    it('successfully resolves AVAILABLE voucher owned by the user', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue({
        id: 'v-1',
        code: 'REDEEM-50P-ABCDEF12',
        userId: 'user-123',
        discountAmount: 10000,
        minOrderValue: 0,
        status: 'AVAILABLE',
        title: 'Voucher Giảm 10.000đ',
      });

      const res = await resolveVoucher('REDEEM-50P-ABCDEF12', 50000, mockPrisma, 'user-123');

      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(10000);
      expect(res.isPersonalVoucher).toBe(true);
    });

    it('rejects personal voucher if used by a different user', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue({
        id: 'v-1',
        code: 'REDEEM-50P-ABCDEF12',
        userId: 'owner-user',
        discountAmount: 10000,
        minOrderValue: 0,
        status: 'AVAILABLE',
      });

      await expect(
        resolveVoucher('REDEEM-50P-ABCDEF12', 50000, mockPrisma, 'attacker-user'),
      ).rejects.toThrow('Mã ưu đãi này không thuộc tài khoản của bạn');
    });

    it('rejects personal voucher if status is RESERVED or REDEEMED', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue({
        id: 'v-1',
        code: 'REDEEM-50P-ABCDEF12',
        userId: 'user-123',
        discountAmount: 10000,
        minOrderValue: 0,
        status: 'RESERVED',
      });

      await expect(
        resolveVoucher('REDEEM-50P-ABCDEF12', 50000, mockPrisma, 'user-123'),
      ).rejects.toThrow('Mã ưu đãi này đã được sử dụng hoặc đang chờ xử lý trong đơn hàng khác');
    });

    it('rejects personal voucher if subtotal does not meet minOrderValue', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue({
        id: 'v-1',
        code: 'REDEEM-200P-XYZ',
        userId: 'user-123',
        discountAmount: 50000,
        minOrderValue: 100000,
        status: 'AVAILABLE',
      });

      await expect(
        resolveVoucher('REDEEM-200P-XYZ', 90000, mockPrisma, 'user-123'),
      ).rejects.toThrow('Đơn hàng cần tối thiểu 100.000đ để áp dụng');
    });
  });

  describe('Global Promotions (Promotion table)', () => {
    it('successfully resolves active global promotion (e.g. WELCOME10)', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue(null);
      mockPrisma.promotion.findFirst.mockResolvedValue({
        id: 'promo-1',
        code: 'WELCOME10',
        discountValue: 10000,
        discountType: 'FIXED_AMOUNT',
        minOrderValue: 50000,
        isActive: true,
      });

      const res = await resolveVoucher('WELCOME10', 80000, mockPrisma, 'any-user');

      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(10000);
      expect(res.isPersonalVoucher).toBe(false);
    });

    it('rejects unknown promotion code', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue(null);
      mockPrisma.promotion.findFirst.mockResolvedValue(null);

      await expect(resolveVoucher('UNKNOWNCODE', 100000, mockPrisma)).rejects.toThrow(
        'Mã ưu đãi "UNKNOWNCODE" không tồn tại trên hệ thống',
      );
    });
  });
});

