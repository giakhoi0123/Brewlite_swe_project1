import type {
  CartItem,
  CartLineInput,
  CartView,
  ProductSize,
  LoyaltyPoints,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  Product,
  Promotion,
} from "@/types/domain";
export interface ProductService {
  list(): Promise<Product[]>;
  get(id: string): Promise<Product | null>;
}
/** Giỏ hàng của tài khoản đang đăng nhập; `itemId` là `CartItem.key` do server cấp. */
export interface CartService {
  get(userId: string): Promise<CartView>;
  add(userId: string, line: CartLineInput): Promise<CartView>;
  update(
    userId: string,
    itemId: string,
    patch: { quantity?: number; size?: ProductSize["code"] },
  ): Promise<CartView>;
  remove(userId: string, itemId: string): Promise<CartView>;
  clear(userId: string): Promise<CartView>;
  /** Gộp giỏ khách vãng lai sau khi đăng nhập; dòng không hợp lệ bị bỏ qua. */
  merge(
    userId: string,
    lines: CartLineInput[],
  ): Promise<CartView & { skipped: { productId: string; reason: string }[] }>;
}
export interface OrderService {
  create(
    userId: string,
    items: CartItem[],
    promotion?: Promotion,
  ): Promise<Order>;
  mine(userId: string): Promise<Order[]>;
  get(id: string): Promise<Order | null>;
  status(id: string): Promise<OrderStatus | null>;
}
export interface PaymentService {
  pay(
    orderId: string,
    method: PaymentMethod,
    idempotencyKey: string,
    demoOutcome?: "PAID" | "PAYMENT_FAILED" | "UNKNOWN",
  ): Promise<Payment>;
}
export interface PromotionService {
  validate(code: string, subtotal: number): Promise<Promotion>;
}
export interface LoyaltyService {
  get(userId: string): Promise<LoyaltyPoints>;
}
export interface BaristaOrderService {
  list(): Promise<Order[]>;
  transition(id: string, status: OrderStatus): Promise<Order>;
}
