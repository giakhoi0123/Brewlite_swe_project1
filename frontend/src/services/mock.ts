import { demoProducts } from "./demo-products";
import type {
  ProductService,
  OrderService,
  PaymentService,
  PromotionService,
  LoyaltyService,
  BaristaOrderService,
} from "./contracts";
import type { Order, OrderStatus, Payment } from "@/types/domain";
import { cartTotal } from "@/types/domain";
const ORDERS = "brewlite-demo-orders-v1",
  PAYMENTS = "brewlite-demo-payments-v1";
const pause = () => new Promise((r) => setTimeout(r, 350));
const read = <T>(key: string, empty: T): T => {
  if (typeof window === "undefined") return empty;
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? empty;
  } catch {
    return empty;
  }
};
const write = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));
const orders = () => read<Order[]>(ORDERS, []);
const saveOrder = (order: Order) =>
  write(
    ORDERS,
    orders().map((o) => (o.id === order.id ? order : o)),
  );
const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "PAYMENT_FAILED", "CANCELLED"],
  PAYMENT_FAILED: ["PENDING", "CANCELLED"],
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
export const mockProducts: ProductService = {
  async list() {
    await pause();
    return demoProducts;
  },
  async get(id) {
    await pause();
    return demoProducts.find((p) => p.id === id) || null;
  },
};
export const mockOrders: OrderService = {
  async create(userId, items, promotion) {
    await pause();
    if (!items.length) throw new Error("Giỏ hàng trống");
    const subtotal = cartTotal(items),
      discount = promotion?.discount || 0;
    const order: Order = {
      id: `BL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      userId,
      items: structuredClone(items),
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      promotionCode: promotion?.code,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    write(ORDERS, [order, ...orders()]);
    return order;
  },
  async mine(userId) {
    await pause();
    return orders().filter((o) => o.userId === userId);
  },
  async get(id) {
    await pause();
    return orders().find((o) => o.id === id) || null;
  },
  async status(id) {
    await pause();
    return orders().find((o) => o.id === id)?.status || null;
  },
};
export const mockPayments: PaymentService = {
  async pay(orderId, method, idempotencyKey, demoOutcome) {
    await pause();
    const existing = read<Payment[]>(PAYMENTS, []).find(
      (p) => p.idempotencyKey === idempotencyKey,
    );
    if (existing) return existing;
    const order = orders().find((o) => o.id === orderId);
    if (!order) throw new Error("Không tìm thấy đơn hàng");
    if (!["PENDING", "PAYMENT_FAILED"].includes(order.status))
      throw new Error("Đơn hàng không thể thanh toán");
    if (order.status === "PAYMENT_FAILED") saveOrder({ ...order, status: "PENDING" });
    // Kết quả được chọn trong màn demo; khóa ngẫu nhiên vẫn idempotent.
    const status = demoOutcome || "PAID";
    const payment: Payment = {
      id: crypto.randomUUID(),
      orderId,
      method,
      status,
      idempotencyKey,
    };
    write(PAYMENTS, [...read<Payment[]>(PAYMENTS, []), payment]);
    if (status !== "UNKNOWN")
      saveOrder({
        ...order,
        status,
        paymentMethod: method,
        error:
          status === "PAYMENT_FAILED"
            ? "Cổng thanh toán demo từ chối giao dịch"
            : undefined,
      });
    return payment;
  },
};
export const mockPromotions: PromotionService = {
  async validate(code, subtotal) {
    await pause();
    if (code.trim().toUpperCase() !== "BREW10")
      throw new Error("Mã ưu đãi không hợp lệ");
    return {
      code: "BREW10",
      discount: Math.min(10000, Math.floor(subtotal * 0.1)),
    };
  },
};
export const mockLoyalty: LoyaltyService = {
  async get(userId) {
    await pause();
    return {
      points: orders()
        .filter(
          (o) =>
            o.userId === userId &&
            ["PAID", "PREPARING", "READY", "COMPLETED"].includes(o.status),
        )
        .reduce((sum, o) => sum + Math.floor(o.total / 10000), 0),
    };
  },
};
export const mockBarista: BaristaOrderService = {
  async list() {
    await pause();
    return orders().filter((o) =>
      ["PAID", "PREPARING", "READY"].includes(o.status),
    );
  },
  async transition(id, status) {
    await pause();
    const order = orders().find((o) => o.id === id);
    if (!order) throw new Error("Không tìm thấy đơn");
    if (!transitions[order.status].includes(status))
      throw new Error("Chuyển trạng thái không hợp lệ");
    const next = { ...order, status };
    saveOrder(next);
    return next;
  },
};
