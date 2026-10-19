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
  mode === "mock" || mode === "hybrid" ? mode : "api";
const catalogApi = dataMode !== "mock",
  allApi = dataMode === "api";
/** Chỉ hiện bộ chọn phản hồi gateway khi bật rõ ràng trong môi trường kiểm thử. */
export const paymentDemoControls =
  process.env.NEXT_PUBLIC_PAYMENT_DEMO_CONTROLS === "true";
export const services = {
  products: catalogApi ? apiProducts : mockProducts,
  cart: catalogApi ? apiCart : mockCart,
  orders: allApi ? apiOrders : mockOrders,
  payments: allApi ? apiPayments : mockPayments,
  promotions: allApi ? apiPromotions : mockPromotions,
  loyalty: allApi ? apiLoyalty : mockLoyalty,
  barista: allApi ? apiBarista : mockBarista,
};
