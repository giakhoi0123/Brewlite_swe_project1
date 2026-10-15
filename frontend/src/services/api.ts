import { request } from "./http";
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
  CartItem,
  CartLineInput,
  CartView,
  Order,
  Payment,
  Product,
  Promotion,
  LoyaltyPoints,
  OrderStatus,
} from "@/types/domain";
type ApiListProduct = Pick<
  Product,
  "id" | "name" | "price" | "imageUrl" | "stock" | "description"
>;
type ApiDetailProduct = Omit<Product, "category" | "sizes"> & {
  defaultSizeId?: string;
  sizes: (Product["sizes"][number] & { id?: string })[];
};
const normalize = (p: ApiDetailProduct): Product => ({
  ...p,
  category: "Thực đơn",
  sizes: p.sizes.map((s) => ({ ...s, isDefault: s.id === p.defaultSizeId })),
});
export const apiProducts: ProductService = {
  list: async () => {
    const rows = await request<ApiListProduct[]>("/products");
    return rows.map((p) => ({
      ...p,
      category: "Thực đơn",
      sizes: [],
      toppings: [],
    }));
  },
  get: async (id) => {
    try {
      return normalize(
        await request<ApiDetailProduct>(`/products/${encodeURIComponent(id)}`),
      );
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },
};
type ApiCartItem = Omit<CartItem, "key" | "note"> & {
  id: string;
  note: string;
  lineTotal: number;
  available: boolean;
};
type ApiCartView = Omit<CartView, "items"> & { items: ApiCartItem[] };
const toCartView = <T extends ApiCartView>(view: T) => ({
  ...view,
  items: view.items.map(
    (i): CartItem => ({
      key: i.id,
      productId: i.productId,
      name: i.name,
      imageUrl: i.imageUrl,
      size: i.size,
      sizeOptions: i.sizeOptions,
      toppingIds: i.toppingIds,
      toppingNames: i.toppingNames,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      ice: i.ice,
      sugar: i.sugar,
      note: i.note || undefined,
      issue: i.issue,
    }),
  ),
});
const line = (l: CartLineInput) => ({
  productId: l.productId,
  size: l.size,
  toppingIds: l.toppingIds,
  quantity: l.quantity,
  ice: l.ice,
  sugar: l.sugar,
  note: l.note || undefined,
});
// userId không cần gửi: server lấy từ cookie phiên đăng nhập.
export const apiCart: CartService = {
  get: async () => toCartView(await request<ApiCartView>("/cart")),
  add: async (_userId, l) =>
    toCartView(
      await request<ApiCartView>("/cart/items", {
        method: "POST",
        body: JSON.stringify(line(l)),
      }),
    ),
  update: async (_userId, itemId, patch) =>
    toCartView(
      await request<ApiCartView>(`/cart/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    ),
  remove: async (_userId, itemId) =>
    toCartView(
      await request<ApiCartView>(`/cart/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      }),
    ),
  clear: async () =>
    toCartView(await request<ApiCartView>("/cart", { method: "DELETE" })),
  merge: async (_userId, lines) =>
    toCartView(
      await request<
        ApiCartView & { skipped: { productId: string; reason: string }[] }
      >("/cart/merge", {
        method: "POST",
        body: JSON.stringify({ items: lines.map(line) }),
      }),
    ),
};
export const apiOrders: OrderService = {
  create: (_userId, items, promotion) =>
    request<Order>("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.productId,
          size: i.size,
          toppingIds: i.toppingIds,
          quantity: i.quantity,
          ice: i.ice,
          sugar: i.sugar,
          note: i.note,
        })),
        promotionCode: promotion?.code,
      }),
    }),
  mine: () => request<Order[]>("/orders/me"),
  get: (id) => request<Order>(`/orders/${encodeURIComponent(id)}`),
  status: (id) =>
    request<OrderStatus>(`/orders/${encodeURIComponent(id)}/status`),
};
export const apiPayments: PaymentService = {
  pay: (orderId, method, idempotencyKey) =>
    request<Payment>("/payments", {
      method: "POST",
      body: JSON.stringify({ orderId, method, idempotencyKey }),
    }),
};
export const apiPromotions: PromotionService = {
  validate: (code, subtotal) =>
    request<Promotion>("/promotions/validate", {
      method: "POST",
      body: JSON.stringify({ code, subtotal }),
    }),
};
export const apiLoyalty: LoyaltyService = {
  get: () => request<LoyaltyPoints>("/loyalty/me"),
};
export const apiBarista: BaristaOrderService = {
  list: () => request<Order[]>("/staff/orders"),
  get: async (id) => {
    try {
      return await request<Order>(`/staff/orders/${encodeURIComponent(id)}`);
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },
  transition: (id, status) =>
    request<Order>(`/staff/orders/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  cancel: (id, reason) =>
    request<Order>(`/staff/orders/${encodeURIComponent(id)}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
};
