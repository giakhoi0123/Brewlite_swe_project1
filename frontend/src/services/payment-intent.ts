import type { PaymentMethod } from "@/types/domain";

export type PaymentOutcome = "PAID" | "PAYMENT_FAILED" | "UNKNOWN";

export type PaymentIntent = {
  method: PaymentMethod;
  key: string;
  outcome?: PaymentOutcome;
};

const methods: PaymentMethod[] = ["WALLET", "CARD"];
const outcomes: PaymentOutcome[] = ["PAID", "PAYMENT_FAILED", "UNKNOWN"];

export const paymentIntentKey = (orderId: string) =>
  `brewlite-payment-${orderId}`;

export function parsePaymentIntent(raw: string | null): PaymentIntent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PaymentIntent>;
    if (
      !methods.includes(value.method as PaymentMethod) ||
      typeof value.key !== "string" ||
      !value.key.trim() ||
      (value.outcome !== undefined &&
        !outcomes.includes(value.outcome as PaymentOutcome))
    )
      return null;
    return {
      method: value.method as PaymentMethod,
      key: value.key,
      ...(value.outcome ? { outcome: value.outcome as PaymentOutcome } : {}),
    };
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

export function removePaymentIntent(
  orderId: string,
  storage: Pick<Storage, "removeItem"> = sessionStorage,
) {
  storage.removeItem(paymentIntentKey(orderId));
}
