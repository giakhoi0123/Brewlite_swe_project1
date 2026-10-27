export type PaymentIntent = {
  key: string;
};

export const paymentIntentKey = (orderId: string) =>
  `brewlite-payment-${orderId}`;

export function parsePaymentIntent(raw: string | null): PaymentIntent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PaymentIntent>;
    if (typeof value.key !== "string" || !value.key.trim()) return null;
    return { key: value.key };
  } catch {
    return null;
  }
}

/** Chỉ cho phép điều hướng sang cổng thanh toán HTTPS do backend trả về. */
export function parseHttpsPaymentUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function readPaymentIntent(
  orderId: string,
  storage: Pick<Storage, "getItem" | "removeItem"> = sessionStorage,
) {
  const key = paymentIntentKey(orderId);
  const intent = parsePaymentIntent(storage.getItem(key));
  if (!intent) storage.removeItem(key);
  return intent;
}

export function savePaymentIntent(
  orderId: string,
  intent: PaymentIntent,
  storage: Pick<Storage, "setItem"> = sessionStorage,
) {
  storage.setItem(paymentIntentKey(orderId), JSON.stringify(intent));
}

/** Resume keeps the original idempotency key; a real retry gets a fresh one. */
export function preparePaymentIntent(
  orderId: string,
  resume: boolean,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> =
    sessionStorage,
  createKey: () => string = () => crypto.randomUUID(),
): PaymentIntent | null {
  if (resume) return readPaymentIntent(orderId, storage);
  const intent = { key: createKey() };
  savePaymentIntent(orderId, intent, storage);
  return intent;
}

export function removePaymentIntent(
  orderId: string,
  storage: Pick<Storage, "removeItem"> = sessionStorage,
) {
  storage.removeItem(paymentIntentKey(orderId));
}

/**
 * Chỉ xóa giỏ khi tab hiện tại thực sự khởi tạo payment của Order này.
 * Nhờ đó, mở lại URL success của một đơn cũ không thể xóa giỏ mới.
 */
export async function clearCartAfterPaidOrder(
  orderId: string,
  clearCart: () => Promise<boolean>,
  storage: Pick<Storage, "getItem" | "removeItem"> = sessionStorage,
) {
  if (!readPaymentIntent(orderId, storage)) return false;
  const cleared = await clearCart();
  if (!cleared) return false;
  removePaymentIntent(orderId, storage);
  return true;
}
