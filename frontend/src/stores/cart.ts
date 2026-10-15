"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, ProductSize } from "@/types/domain";
import { itemKey } from "@/types/domain";
type CartStore = {
  items: CartItem[];
  promoCode: string;
  add: (item: CartItem) => void;
  setQuantity: (key: string, quantity: number) => void;
  changeSize: (key: string, size: ProductSize["code"], unitPrice: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setPromoCode: (code: string) => void;
};
const merge = (items: CartItem[], item: CartItem) =>
  items.some((i) => i.key === item.key)
    ? items.map((i) =>
        i.key === item.key
          ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) }
          : i,
      )
    : [...items, item];
export const useCart = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      promoCode: "",
      add: (item) => set((s) => ({ items: merge(s.items, item) })),
      setQuantity: (key, quantity) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.key === key
              ? {
                  ...i,
                  quantity: Math.max(1, Math.min(99, Math.floor(quantity))),
                }
              : i,
          ),
        })),
      // Đổi size trong giỏ: tính lại khóa cấu hình, gộp nếu trùng món đã có.
      changeSize: (key, size, unitPrice) =>
        set((s) => {
          const current = s.items.find((i) => i.key === key);
          if (!current || current.size === size) return s;
          const next: CartItem = {
            ...current,
            size,
            unitPrice,
            key: itemKey(
              current.productId,
              size,
              current.toppingIds,
              current.ice,
              current.sugar,
              current.note,
            ),
          };
          const index = s.items.indexOf(current),
            rest = s.items.filter((i) => i.key !== key);
          if (rest.some((i) => i.key === next.key)) return { items: merge(rest, next) };
          rest.splice(index, 0, next);
          return { items: rest };
        }),
      remove: (key) =>
        set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [], promoCode: "" }),
      setPromoCode: (promoCode) => set({ promoCode }),
    }),
    { name: "brewlite-cart-v1" },
  ),
);
