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
  cancel?(id: string, reason?: string): Promise<Order>;
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

export interface UserVoucher {
  id?: string;
  code: string;
  title: string;
  description?: string;
  discountAmount: number;
  minOrderValue?: number;
  status?: string;
  isUsed?: boolean;
  createdAt: string;
}

export interface LoyaltyService {
  get(userId: string): Promise<LoyaltyPoints>;
  vouchers?(userId?: string): Promise<UserVoucher[]>;
  redeem?(
    userId: string,
    option: { id: string; title?: string; pointsCost?: number; discountAmount?: number },
  ): Promise<{ success: boolean; code: string; remainingPoints: number }>;
}

export interface BaristaOrderService {
  list(): Promise<Order[]>;
  get(id: string): Promise<Order | null>;
  transition(id: string, status: OrderStatus): Promise<Order>;
  cancel(id: string, reason: string): Promise<Order>;
}