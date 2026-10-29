"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, ProductSize } from "@/types/domain";
import { itemKey } from "@/types/domain";
import { services } from "@/services";
/**
 * Giỏ hàng chỉ nằm ở trình duyệt (Zustand persist → localStorage), dùng chung cho khách và người đã đăng nhập.
 * Giá ở đây chỉ để hiển thị: `POST /orders` nhận cấu hình món và backend tính lại giá, kiểm tồn kho.
 */
type CartStore = {
  items: CartItem[];
  promoCode: string;
  busy: boolean;
  error: string;
  add: (item: CartItem) => Promise<boolean>;
  setQuantity: (key: string, quantity: number) => Promise<boolean>;
  changeSize: (key: string, size: ProductSize["code"], unitPrice: number) => Promise<boolean>;
  remove: (key: string) => void;
  /** Trả Promise để luồng thanh toán (`clearCartAfterPaidOrder`) chờ xóa xong. */
  clear: () => Promise<boolean>;
  setPromoCode: (code: string) => void;
};
export const MAX_QUANTITY = 99;
const clampQuantity = (n: number) =>
  Math.max(1, Math.min(MAX_QUANTITY, Math.floor(n)));
/** Cùng `key` (cùng món + size + topping + đá + đường + ghi chú) thì cộng số lượng thay vì thêm dòng. */
const merge = (items: CartItem[], item: CartItem) =>
  items.some((i) => i.key === item.key)
    ? items.map((i) =>
        i.key === item.key
          ? { ...i, quantity: clampQuantity(i.quantity + item.quantity) }
          : i,
      )
    : [...items, { ...item, quantity: clampQuantity(item.quantity) }];

async function checkedChange(change: (state: CartStore) => { items: CartItem[] }, reduction = false) {
  const before = useCart.getState();
  if (before.busy) return false;
  const next = change(before);
  useCart.setState({ busy: true, error: '' });
  try {
    if (!reduction) await services.products.validateCart(next.items);
    // A remove/clear/other-tab hydration while checking must never be overwritten.
    if (useCart.getState().items !== before.items) throw new Error('Giỏ hàng vừa thay đổi. Vui lòng thử lại');
    useCart.setState(next);
    return true;
  } catch (error) {
    useCart.setState({ error: error instanceof Error ? error.message : 'Không thể kiểm tra nguyên liệu' });
    return false;
  } finally { useCart.setState({ busy: false }); }
}
export const useCart = create<CartStore>()(
  persist(
    (set, get): CartStore => ({
      items: [],
      promoCode: "",
      busy: false,
      error: '',
      add: (item) => checkedChange((s) => ({ items: merge(s.items, item) })),
      setQuantity: (key, quantity) =>
        checkedChange((s) => ({
          items: s.items.map((i) =>
            i.key === key ? { ...i, quantity: clampQuantity(quantity) } : i,
          ),
        }), quantity <= (get().items.find((i) => i.key === key)?.quantity ?? 0)),
      // Đổi size tạo khóa mới; trùng một dòng khác thì gộp, không thì giữ nguyên vị trí.
      changeSize: (key, size, unitPrice) =>
        checkedChange((s) => {
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
        }),
      remove: (key) =>
        set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: async () => {
        set({ items: [], promoCode: "", error: '' });
        return true;
      },
      setPromoCode: (promoCode) => set({ promoCode }),
    }),
    {
      name: "brewlite-cart-v1",
      version: 2,
      partialize: (s) => ({ items: s.items, promoCode: s.promoCode }),
      // Bản cũ có thể chứa giỏ lấy từ server (key là UUID dòng, có `issue`): tính lại key và bỏ trường server.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<CartStore>;
        const items = (state.items ?? []).map(
          (i): CartItem => ({
            key: itemKey(i.productId, i.size, i.toppingIds, i.ice, i.sugar, i.note),
            productId: i.productId,
            name: i.name,
            imageUrl: i.imageUrl,
            size: i.size,
            toppingIds: i.toppingIds,
            toppingNames: i.toppingNames,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            ice: i.ice,
            sugar: i.sugar,
            note: i.note,
            sizeOptions: i.sizeOptions,
          }),
        );
        return {
          items: items.reduce<CartItem[]>(merge, []),
          promoCode: state.promoCode ?? "",
        } as CartStore;
      },
    },
  ),
);
