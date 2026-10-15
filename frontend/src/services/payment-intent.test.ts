import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePaymentIntent,
  paymentIntentKey,
  readPaymentIntent,
  removePaymentIntent,
  savePaymentIntent,
} from "./payment-intent";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
};

test("payment intent accepts only supported methods and outcomes", () => {
  assert.deepEqual(
    parsePaymentIntent(
      JSON.stringify({ method: "CARD", key: "payment-key", outcome: "PAID" }),
    ),
    { method: "CARD", key: "payment-key", outcome: "PAID" },
  );
  assert.equal(parsePaymentIntent("not-json"), null);
  assert.equal(
    parsePaymentIntent(JSON.stringify({ method: "CASH", key: "payment-key" })),
    null,
  );
  assert.equal(
    parsePaymentIntent(JSON.stringify({ method: "WALLET", key: "" })),
    null,
  );
});

test("payment intent storage preserves the selected method for retry", () => {
  const storage = memoryStorage();
  savePaymentIntent(
    "order-1",
    { method: "CARD", key: "first-key", outcome: "PAYMENT_FAILED" },
    storage,
  );
  assert.equal(readPaymentIntent("order-1", storage)?.method, "CARD");
  removePaymentIntent("order-1", storage);
  assert.equal(storage.values.has(paymentIntentKey("order-1")), false);
});

test("invalid stored payment intent is discarded", () => {
  const storage = memoryStorage();
  storage.setItem(paymentIntentKey("order-2"), "{");
  assert.equal(readPaymentIntent("order-2", storage), null);
  assert.equal(storage.values.has(paymentIntentKey("order-2")), false);
});
