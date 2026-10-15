import { demoProducts } from "./demo-products";
import type {
  CartService,
  ProductService,
  OrderService,
  PaymentService,
  PromotionService,
  LoyaltyService,
  BaristaOrderService,
} from "./contracts";
import type {
  CartLineInput,
  CartView,
  Order,
  OrderStatus,
  Payment,
} from "@/types/domain";
import { cartTotal, itemKey } from "@/types/domain";
const ORDERS = "brewlite-demo-orders-v1",
  PAYMENTS = "brewlite-demo-payments-v1",
  CARTS = "brewlite-demo-carts-v1";
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
// Giỏ theo tài khoản giả lập POST/PATCH/DELETE /cart: giá luôn tính lại từ demoProducts.
type StoredLine = CartLineInput & { id: string; note: string };
const lineKey = (l: StoredLine) =>
  itemKey(l.productId, l.size, l.toppingIds, l.ice, l.sugar, l.note);
const readCart = (userId: string) =>
  read<Record<string, StoredLine[]>>(CARTS, {})[userId] ?? [];
const writeCart = (userId: string, lines: StoredLine[]) =>
  write(CARTS, { ...read<Record<string, StoredLine[]>>(CARTS, {}), [userId]: lines });
const priceLine = (l: Pick<StoredLine, "productId" | "size" | "toppingIds">) => {
  const product = demoProducts.find((p) => p.id === l.productId);
  if (!product) throw new Error("Không tìm thấy sản phẩm");
  const size = product.sizes.find((s) => s.code === l.size);
  if (!size?.available) throw new Error(`Size ${l.size} tạm hết`);
  const toppings = l.toppingIds.map((id) => {
    const t = product.toppings.find((x) => x.id === id);
    if (!t) throw new Error("Topping không thuộc món này");
    if (!t.available) throw new Error(`${t.name} tạm hết`);
    return t;
  });
  return { product, size, toppings };
};
const stockError = (lines: StoredLine[], productId: string, before: number) => {
  const product = demoProducts.find((p) => p.id === productId)!;
  const total = lines
    .filter((l) => l.productId === productId)
    .reduce((n, l) => n + l.quantity, 0);
  if (total > before && total > product.stock)
    throw new Error(
      product.stock === 0
        ? `${product.name} đang hết hàng`
        : `${product.name} chỉ còn ${product.stock} phần`,
    );
};
const productTotal = (lines: StoredLine[], productId: string) =>
  lines.filter((l) => l.productId === productId).reduce((n, l) => n + l.quantity, 0);
const cartView = (lines: StoredLine[]): CartView => {
  const items = lines.map((l) => {
    const { product, size, toppings } = priceLine(l);
    const issue =
      productTotal(lines, l.productId) > product.stock
        ? `${product.name} chỉ còn ${product.stock} phần`
        : undefined;
    return {
      key: l.id,
      productId: l.productId,
      name: product.name,
      imageUrl: product.imageUrl,
      size: l.size,
      sizeOptions: product.sizes,
      toppingIds: l.toppingIds,
      toppingNames: toppings.map((t) => t.name),
      unitPrice:
        product.price + size.extraPrice + toppings.reduce((n, t) => n + t.extraPrice, 0),
      quantity: l.quantity,
      ice: l.ice,
      sugar: l.sugar,
      note: l.note || undefined,
      ...(issue ? { issue } : {}),
    };
  });
  return {
    items,
    totalQuantity: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: cartTotal(items),
    valid: items.every((i) => !i.issue),
  };
};
const addLine = (lines: StoredLine[], input: CartLineInput) => {
  priceLine(input);
  const line: StoredLine = {
    ...input,
    toppingIds: [...new Set(input.toppingIds)].sort(),
    note: (input.note ?? "").trim(),
    id: crypto.randomUUID(),
  };
  const before = productTotal(lines, line.productId);
  const existing = lines.find((l) => lineKey(l) === lineKey(line));
  const next = existing
    ? lines.map((l) =>
        l === existing
          ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) }
          : l,
      )
    : [...lines, line];
  stockError(next, line.productId, before);
  return next;
};
export const mockCart: CartService = {
  async get(userId) {
    await pause();
    return cartView(readCart(userId));
  },
  async add(userId, input) {
    await pause();
    const next = addLine(readCart(userId), input);
    writeCart(userId, next);
    return cartView(next);
  },
  async update(userId, itemId, patch) {
    await pause();
    const lines = readCart(userId),
      item = lines.find((l) => l.id === itemId);
    if (!item) throw new Error("Không tìm thấy món trong giỏ");
    const changed = {
      ...item,
      size: patch.size ?? item.size,
      quantity: patch.quantity ?? item.quantity,
    };
    if (changed.size !== item.size) priceLine(changed);
    const target = lines.find((l) => l.id !== item.id && lineKey(l) === lineKey(changed));
    const next = target
      ? lines
          .filter((l) => l.id !== item.id)
          .map((l) =>
            l === target
              ? { ...l, quantity: Math.min(99, l.quantity + changed.quantity) }
              : l,
          )
      : lines.map((l) => (l.id === item.id ? changed : l));
    stockError(next, item.productId, productTotal(lines, item.productId));
    writeCart(userId, next);
    return cartView(next);
  },
  async remove(userId, itemId) {
    await pause();
    const lines = readCart(userId);
    if (!lines.some((l) => l.id === itemId))
      throw new Error("Không tìm thấy món trong giỏ");
    const next = lines.filter((l) => l.id !== itemId);
    writeCart(userId, next);
    return cartView(next);
  },
  async clear(userId) {
    await pause();
    writeCart(userId, []);
    return cartView([]);
  },
  async merge(userId, inputs) {
    await pause();
    let lines = readCart(userId);
    const skipped: { productId: string; reason: string }[] = [];
    for (const input of inputs) {
      try {
        lines = addLine(lines, input);
      } catch (e) {
        skipped.push({
          productId: input.productId,
          reason: e instanceof Error ? e.message : "Không hợp lệ",
        });
      }
    }
    writeCart(userId, lines);
    return { ...cartView(lines), skipped };
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
