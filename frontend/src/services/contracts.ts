import type {
  CartItem,
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
