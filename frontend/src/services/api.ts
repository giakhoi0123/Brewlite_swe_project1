import { request } from "./http";
import type {
  ProductService,
  OrderService,
  PaymentService,
  PromotionService,
  LoyaltyService,
  BaristaOrderService,
  UserVoucher,
} from "./contracts";
import type {
  Order,
  Payment,
  Product,
  ProductPreviewResult,
  Promotion,
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
  validateCart: async (items) => {
    await request('/products/availability', {
      method: 'POST',
      body: JSON.stringify({ items: items.map(({ productId, size, toppingIds, quantity, ice, sugar, note }) =>
        ({ productId, size, toppingIds, quantity, ice, sugar, note })) }),
    });
  },
  previewSelection: async (candidate, cartItems = []) => {
    return request<ProductPreviewResult>('/products/preview', {
      method: 'POST',
      body: JSON.stringify({
        candidate: {
          productId: candidate.productId,
          size: candidate.size,
          toppingIds: candidate.toppingIds,
          quantity: candidate.quantity,
          ice: candidate.ice,
          sugar: candidate.sugar,
          note: candidate.note,
        },
        cartItems: cartItems.map((i) => ({
          productId: i.productId,
          size: i.size,
          toppingIds: i.toppingIds,
          quantity: i.quantity,
          ice: i.ice,
          sugar: i.sugar,
          note: i.note,
        })),
      }),
    });
  },
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
        await request<ApiDetailProduct>(`/products/${encodeURIComponent(id)}`, { cache: 'no-store' }),
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
          note: i.note,
        })),
        promotionCode: promotion?.code,
      }),
    }),
  mine: () => request<Order[]>("/orders/me"),
  get: (id) =>
    request<Order>(`/orders/${encodeURIComponent(id)}`, { cache: "no-store" }),
  status: (id) =>
    request<{ status: OrderStatus }>(
      `/orders/${encodeURIComponent(id)}/status`,
      { cache: "no-store" },
    )
      .then((result) => result.status),
  cancel: (id, reason) =>
    request<Order>(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

export const apiPayments: PaymentService = {
  pay: (orderId, method, idempotencyKey) =>
    request<Payment>("/payments", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        orderId,
        method,
        idempotencyKey,
      }),
    }),
  reconcile: (orderId) =>
    request<Payment>(
      `/payments/${encodeURIComponent(orderId)}/reconcile`,
      { method: "POST" },
    ),
};

export const apiPromotions: PromotionService = {
  validate: (code, subtotal) =>
    request<Promotion>("/promotions/validate", {
      method: "POST",
      body: JSON.stringify({ code, subtotal }),
    }),
};

export const apiLoyalty: LoyaltyService = {
  get: async () => {
    try {
      return await request<{ points: number }>("/loyalty/me");
    } catch {
      const response = await request<{ user: { loyaltyPoints: number } }>("/auth/me");
      return { points: response.user.loyaltyPoints };
    }
  },

  vouchers: async () => {
    return request<UserVoucher[]>("/loyalty/vouchers");
  },

  redeem: async (_userId: string, option: { id: string }) => {
    return request<{ success: boolean; voucherCode: string; code: string; remainingPoints: number }>(
      "/loyalty/redeem",
      {
        method: "POST",
        body: JSON.stringify({
          rewardId: option.id,
        }),
      },
    );
  },
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
