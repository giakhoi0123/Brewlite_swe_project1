"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types/domain";
type CartStore = {
  items: CartItem[];
  add: (item: CartItem) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};
export const useCart = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => ({
          items: s.items.some((i) => i.key === item.key)
            ? s.items.map((i) =>
                i.key === item.key
                  ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) }
                  : i,
              )
            : [...s.items, item],
        })),
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
      remove: (key) =>
        set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: "brewlite-cart-v1" },
  ),
);
