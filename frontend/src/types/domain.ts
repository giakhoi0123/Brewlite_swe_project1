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
  /** Server báo dòng này không còn hợp lệ (hết hàng, size/topping tạm hết). */
  issue?: string;
};
/** Giỏ hàng lưu theo tài khoản; giá do server tính lại. */
export type CartView = {
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
  valid: boolean;
};
export type CartLineInput = Pick<
  CartItem,
  "productId" | "size" | "toppingIds" | "quantity" | "ice" | "sugar" | "note"
>;
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
