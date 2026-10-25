export type Role = "CUSTOMER" | "BARISTA";
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  loyaltyPoints: number;
};
export type ProductSize = {
  code: "S" | "M" | "L";
  name: string;
  extraPrice: number;
  available: boolean;
  isDefault?: boolean;
};
export type Topping = {
  id: string;
  name: string;
  extraPrice: number;
  available: boolean;
};
export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  category: string;
  sizes: ProductSize[];
  toppings: Topping[];
};
export type CartItem = {
  key: string;
  productId: string;
  name: string;
  imageUrl: string;
  size: ProductSize["code"];
  toppingIds: string[];
  toppingNames: string[];
  unitPrice: number;
  quantity: number;
  ice: string;
  sugar: string;
  note?: string;
  /** Các size của món, để đổi size ngay trong giỏ. */
  sizeOptions?: ProductSize[];
};
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PAYMENT_FAILED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";
export type PaymentMethod = "WALLET" | "CARD" | "VNPAY_QR";
export type OrderItem = CartItem;
export type Order = {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  promotionCode?: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  createdAt: string;
  completedAt?: string;
  error?: string;
  customerName?: string;
  cancelReason?: string;
};
export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: "PROCESSING" | "PAID" | "PAYMENT_FAILED" | "UNKNOWN";
  idempotencyKey: string;
  paymentUrl?: string;
  expiresAt?: string;
};
export type Promotion = { code: string; discount: number };
export type LoyaltyPoints = { points: number };

export const money = (n: number) =>
  new Intl.NumberFormat("vi-VN").format(n) + " ₫";
export const lineTotal = (item: CartItem) => item.unitPrice * item.quantity;
export const cartTotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + lineTotal(item), 0);
export const itemKey = (
  id: string,
  size: string,
  toppings: string[],
  ice: string,
  sugar: string,
  note = "",
) =>
  [id, size, [...toppings].sort().join(","), ice, sugar, note.trim()].join("|");

export interface RewardOption {
  id: string;
  title: string;
  discountAmount: number;
  pointsCost: number;
  description: string;
}

export const REWARD_OPTIONS: RewardOption[] = [
  {
    id: "rw-10k",
    title: "Voucher Giảm 10.000đ",
    discountAmount: 10000,
    pointsCost: 50,
    description: "Đổi 50 điểm nhận mã giảm 10.000đ cho mọi đơn hàng",
  },
  {
    id: "rw-20k",
    title: "Voucher Giảm 20.000đ",
    discountAmount: 20000,
    pointsCost: 100,
    description: "Đổi 100 điểm nhận mã giảm 20.000đ cho mọi đơn hàng",
  },
  {
    id: "rw-50k",
    title: "Voucher Giảm 50.000đ",
    discountAmount: 50000,
    pointsCost: 200,
    description: "Đổi 200 điểm nhận mã giảm 50.000đ cho đơn từ 100.000đ",
  },
];