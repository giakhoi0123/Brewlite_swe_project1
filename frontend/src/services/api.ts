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
  OrderStatus,
  RewardOption,
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

  /**
   * Bộ xử lý tham số linh hoạt chống lỗi 400 Bad Request & nhầm lẫn thông số gói đổi điểm
   */
  redeem: async (...args: any[]) => {
    let points = 50;
    let discount = 10000;
    let minOrder = 0;

    const validArgs = args.filter((a) => a !== null && a !== undefined);

    // 1. Trường hợp tham số truyền vào là Object
    const objArg = validArgs.find((a) => typeof a === "object");
    if (objArg) {
      points = Number(objArg.points || objArg.pointsToRedeem || 50);
      discount = Number(
        objArg.discountAmount ||
          objArg.discount ||
          (points >= 200 ? 50000 : points >= 100 ? 20000 : 10000),
      );
      minOrder = Number(
        objArg.minOrderValue ?? (discount >= 50000 ? 100000 : 0),
      );
    } else {
      // 2. Trường hợp tham số truyền vào là các số rời
      const numArgs = validArgs.filter((a) => typeof a === "number");

      if (numArgs.length === 1) {
        // Ví dụ: redeem(50) hoặc redeem(200)
        points = numArgs[0];
        discount = points >= 200 ? 50000 : points >= 100 ? 20000 : 10000;
        minOrder = discount >= 50000 ? 100000 : 0;
      } else if (numArgs.length >= 2) {
        // Kiểm tra xem số đầu tiên có phải là số điểm (thường <= 1000)
        if (numArgs[0] <= 1000) {
          // Ví dụ: redeem(50, 10000, 0) hoặc redeem(200, 50000, 100000)
          points = numArgs[0];
          discount = numArgs[1];
          minOrder = numArgs[2] ?? (discount >= 50000 ? 100000 : 0);
        } else {
          // Nếu số đầu tiên lớn (> 1000), có thể là tiền giảm giá hoặc tham số bị lệch
          discount = numArgs[0];
          points = discount >= 50000 ? 200 : discount >= 20000 ? 100 : 50;
          minOrder = numArgs[1] ?? (discount >= 50000 ? 100000 : 0);
        }
      }
    }

    // Đảm bảo dữ liệu hợp lệ trước khi gửi API
    if (isNaN(points) || points <= 0) points = 50;
    if (isNaN(discount) || discount <= 0) {
      discount = points >= 200 ? 50000 : points >= 100 ? 20000 : 10000;
    }
    if (isNaN(minOrder) || minOrder < 0) {
      minOrder = discount >= 50000 ? 100000 : 0;
    }

    console.log(`🎁 [REDEEM API CALL]: Points=${points}, Discount=${discount}đ, MinOrder=${minOrder}đ`);

    return request<{ success: boolean; voucherCode: string; code: string; remainingPoints: number }>(
      "/loyalty/redeem",
      {
        method: "POST",
        body: JSON.stringify({
          pointsToRedeem: points,
          discountAmount: discount,
          minOrderValue: minOrder,
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
