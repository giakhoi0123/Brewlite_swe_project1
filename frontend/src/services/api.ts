import { request } from "./http";
import type {
  ProductService,
  OrderService,
  PaymentService,
  PromotionService,
  LoyaltyService,
  BaristaOrderService,
} from "./contracts";
import type {
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
  transition: (id, status) =>
    request<Order>(`/staff/orders/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
