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
};
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PAYMENT_FAILED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";
export type PaymentMethod = "WALLET" | "CARD";
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
  error?: string;
};
export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: "PAID" | "PAYMENT_FAILED" | "UNKNOWN";
  idempotencyKey: string;
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
) => [id, size, [...toppings].sort().join(","), ice, sugar].join("|");
