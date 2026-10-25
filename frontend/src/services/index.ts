import {
  apiProducts,
  apiOrders,
  apiPayments,
  apiPromotions,
  apiLoyalty,
  apiBarista,
} from "./api";
import {
  mockProducts,
  mockOrders,
  mockPayments,
  mockPromotions,
  mockLoyalty,
  mockBarista,
} from "./mock";
/**
 * mock: mọi module giả lập (trừ auth).
 * hybrid: sản phẩm gọi backend thật; đơn/thanh toán/ưu đãi/điểm/Barista vẫn giả lập.
 * Giỏ hàng không có service: luôn nằm trong Zustand (`stores/cart.ts`) ở mọi chế độ.
 * api: mọi module gọi REST; lỗi không tự chuyển sang mock.
 */
export type DataMode = "mock" | "hybrid" | "api";
const mode = process.env.NEXT_PUBLIC_DATA_MODE;
export const dataMode: DataMode =
  mode === "mock" || mode === "hybrid" ? mode : "api";
const catalogApi = dataMode !== "mock",
  allApi = dataMode === "api";
export const services = {
  products: catalogApi ? apiProducts : mockProducts,
  orders: allApi ? apiOrders : mockOrders,
  payments: allApi ? apiPayments : mockPayments,
  promotions: allApi ? apiPromotions : mockPromotions,
  loyalty: allApi ? apiLoyalty : mockLoyalty,
  barista: allApi ? apiBarista : mockBarista,
};
