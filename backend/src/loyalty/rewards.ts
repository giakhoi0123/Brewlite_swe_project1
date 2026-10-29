export interface RewardConfig {
  id: string;
  title: string;
  pointsCost: number;
  discountAmount: number;
  minOrderValue: number;
  description: string;
}

export const REWARDS: Record<string, RewardConfig> = {
  'rw-10k': {
    id: 'rw-10k',
    title: 'Voucher Giảm 10.000đ',
    pointsCost: 50,
    discountAmount: 10000,
    minOrderValue: 0,
    description: 'Đổi 50 điểm nhận mã giảm 10.000đ cho mọi đơn hàng',
  },
  'rw-20k': {
    id: 'rw-20k',
    title: 'Voucher Giảm 20.000đ',
    pointsCost: 100,
    discountAmount: 20000,
    minOrderValue: 0,
    description: 'Đổi 100 điểm nhận mã giảm 20.000đ cho mọi đơn hàng',
  },
  'rw-50k': {
    id: 'rw-50k',
    title: 'Voucher Giảm 50.000đ',
    pointsCost: 200,
    discountAmount: 50000,
    minOrderValue: 100000,
    description: 'Đổi 200 điểm nhận mã giảm 50.000đ cho đơn từ 100.000đ',
  },
};

