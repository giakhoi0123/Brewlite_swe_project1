import type {
  CartItem,
  LoyaltyPoints,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  Product,
  Promotion,
  RewardOption,
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
  ): Promise<Payment>;
  reconcile(orderId: string): Promise<Payment>;
}

export interface PromotionService {
  validate(code: string, subtotal: number): Promise<Promotion>;
}

export interface LoyaltyService {
  get(userId: string): Promise<LoyaltyPoints>;
  redeem?(
    userId: string,
    option: RewardOption,
  ): Promise<{ success: boolean; code: string; remainingPoints: number }>;
}

export interface BaristaOrderService {
  list(): Promise<Order[]>;
  get(id: string): Promise<Order | null>;
  transition(id: string, status: OrderStatus): Promise<Order>;
  cancel(id: string, reason: string): Promise<Order>;
}