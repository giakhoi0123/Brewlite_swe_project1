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
export const dataMode =
  process.env.NEXT_PUBLIC_DATA_MODE === "api" ? "api" : "mock";
export const services =
  dataMode === "api"
    ? {
        products: apiProducts,
        orders: apiOrders,
        payments: apiPayments,
        promotions: apiPromotions,
        loyalty: apiLoyalty,
        barista: apiBarista,
      }
    : {
        products: mockProducts,
        orders: mockOrders,
        payments: mockPayments,
        promotions: mockPromotions,
        loyalty: mockLoyalty,
        barista: mockBarista,
      };
