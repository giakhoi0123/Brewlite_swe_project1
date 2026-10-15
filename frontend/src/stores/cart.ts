"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { services } from "@/services";
import type { CartItem, CartLineInput, CartView, ProductSize } from "@/types/domain";
import { itemKey } from "@/types/domain";
/**
 * Khách vãng lai: giỏ chỉ nằm trong Zustand (localStorage).
 * Đã đăng nhập (`owner`): giỏ thuộc server, mỗi thao tác gọi CartService rồi lấy lại giỏ server trả về.
 * Các thao tác trả về `true` khi thành công; lỗi được ghi vào `error`.
 */
type CartStore = {
  items: CartItem[];
  promoCode: string;
  owner: string | null;
  busy: boolean;
  error: string;
  add: (item: CartItem) => Promise<boolean>;
  setQuantity: (key: string, quantity: number) => Promise<boolean>;
  changeSize: (key: string, size: ProductSize["code"], unitPrice: number) => Promise<boolean>;
  remove: (key: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  setPromoCode: (code: string) => void;
  /** Gắn giỏ với tài khoản: gộp giỏ khách lên server hoặc tải lại giỏ của tài khoản. */
  attach: (userId: string) => Promise<boolean>;
  /** Đăng xuất: bỏ bản sao giỏ của tài khoản khỏi máy. */
  detach: () => void;
  dismissError: () => void;
};
const clampQuantity = (n: number) => Math.max(1, Math.min(99, Math.floor(n)));
const merge = (items: CartItem[], item: CartItem) =>
  items.some((i) => i.key === item.key)
    ? items.map((i) =>
        i.key === item.key
          ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) }
          : i,
      )
    : [...items, item];
const toLine = (i: CartItem): CartLineInput => ({
  productId: i.productId,
  size: i.size,
  toppingIds: i.toppingIds,
  quantity: i.quantity,
  ice: i.ice,
  sugar: i.sugar,
  note: i.note,
});
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Không thể cập nhật giỏ hàng";
export const useCart = create<CartStore>()(
  persist(
    (set, get) => {
      const remote = async (work: (userId: string) => Promise<CartView>) => {
        const owner = get().owner;
        if (!owner) return false;
        set({ busy: true, error: "" });
        try {
          const view = await work(owner);
          // Bỏ qua kết quả nếu người dùng đã đăng xuất/đổi tài khoản trong lúc chờ.
          if (get().owner === owner) set({ items: view.items });
          return true;
        } catch (e) {
          if (get().owner === owner) set({ error: message(e) });
          return false;
        } finally {
          set({ busy: false });
        }
      };
      return {
        items: [],
        promoCode: "",
        owner: null,
        busy: false,
        error: "",
        add: async (item) => {
          if (get().owner)
            return remote((u) => services.cart.add(u, toLine(item)));
          set((s) => ({ items: merge(s.items, item) }));
          return true;
        },
        setQuantity: async (key, quantity) => {
          if (get().owner)
            return remote((u) =>
              services.cart.update(u, key, { quantity: clampQuantity(quantity) }),
            );
          set((s) => ({
            items: s.items.map((i) =>
              i.key === key ? { ...i, quantity: clampQuantity(quantity) } : i,
            ),
          }));
          return true;
        },
        // Đổi size: server tự tính giá; khách vãng lai tính khóa mới và gộp nếu trùng.
        changeSize: async (key, size, unitPrice) => {
          if (get().owner)
            return remote((u) => services.cart.update(u, key, { size }));
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
            if (rest.some((i) => i.key === next.key))
              return { items: merge(rest, next) };
            rest.splice(index, 0, next);
            return { items: rest };
          });
          return true;
        },
        remove: async (key) => {
          if (get().owner) return remote((u) => services.cart.remove(u, key));
          set((s) => ({ items: s.items.filter((i) => i.key !== key) }));
          return true;
        },
        clear: async () => {
          set({ promoCode: "" });
          if (get().owner) return remote((u) => services.cart.clear(u));
          set({ items: [] });
          return true;
        },
        setPromoCode: (promoCode) => set({ promoCode }),
        attach: async (userId) => {
          const { owner, items } = get();
          if (owner === userId) return remote((u) => services.cart.get(u));
          // Giỏ khách (owner null) được gộp lên; bản sao của tài khoản khác thì bỏ.
          const guest = owner ? [] : items;
          set({ owner: userId, items: owner ? [] : items });
          if (!guest.length) return remote((u) => services.cart.get(u));
          return remote(async (u) => {
            const view = await services.cart.merge(u, guest.map(toLine));
            if (view.skipped.length)
              set({
                error: `Một số món không thể chuyển vào giỏ tài khoản: ${view.skipped
                  .map((s) => s.reason)
                  .join("; ")}`,
              });
            return view;
          });
        },
        detach: () => set({ items: [], owner: null, promoCode: "", error: "" }),
        dismissError: () => set({ error: "" }),
      };
    },
    {
      name: "brewlite-cart-v1",
      partialize: (s) => ({ items: s.items, promoCode: s.promoCode, owner: s.owner }),
    },
  ),
);
