import {
  apiProducts,
  apiCart,
  apiOrders,
  apiPayments,
  apiPromotions,
  apiLoyalty,
  apiBarista,
} from "./api";
import {
  mockProducts,
  mockCart,
  mockOrders,
  mockPayments,
  mockPromotions,
  mockLoyalty,
  mockBarista,
} from "./mock";
/**
 * mock: mọi module giả lập (trừ auth).
 * hybrid: sản phẩm + giỏ hàng gọi backend thật (đã có); đơn/thanh toán/ưu đãi/điểm/Barista vẫn giả lập.
 * api: mọi module gọi REST; lỗi không tự chuyển sang mock.
 */
export type DataMode = "mock" | "hybrid" | "api";
const mode = process.env.NEXT_PUBLIC_DATA_MODE;
export const dataMode: DataMode =
  mode === "api" || mode === "hybrid" ? mode : "mock";
const catalogApi = dataMode !== "mock",
  allApi = dataMode === "api";
/** Thanh toán/đơn hàng còn giả lập: hiện lựa chọn kết quả demo và banner. */
export const demoOrders = !allApi;
/** Cho phép chọn phản hồi gateway sandbox mà vẫn dùng Orders/Payments API thật. */
export const paymentDemoControls =
  demoOrders || process.env.NEXT_PUBLIC_PAYMENT_DEMO_CONTROLS === "true";
// Sửa đoạn export const services ở cuối file thành:
export const services = {
  products: apiProducts,
  cart: apiCart,
  orders: apiOrders,
  payments: apiPayments,
  promotions: apiPromotions,
  loyalty: apiLoyalty,
  barista: apiBarista,
};
