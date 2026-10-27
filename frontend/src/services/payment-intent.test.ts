import test from "node:test";
import assert from "node:assert/strict";
import {
  clearCartAfterPaidOrder,
  parsePaymentIntent,
  parseHttpsPaymentUrl,
  paymentIntentKey,
  preparePaymentIntent,
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

test("payment intent stores only a non-empty idempotency key", () => {
  assert.deepEqual(
    parsePaymentIntent(JSON.stringify({ key: "payment-key" })),
    { key: "payment-key" },
  );
  assert.equal(parsePaymentIntent("not-json"), null);
  assert.equal(parsePaymentIntent(JSON.stringify({ key: "" })), null);
});

test("payment intent storage preserves the idempotency key for safe retry", () => {
  const storage = memoryStorage();
  savePaymentIntent("order-1", { key: "first-key" }, storage);
  assert.equal(readPaymentIntent("order-1", storage)?.key, "first-key");
  removePaymentIntent("order-1", storage);
  assert.equal(storage.values.has(paymentIntentKey("order-1")), false);
});

test("checkout resume reuses its key while a finalized retry creates a new key", () => {
  const storage = memoryStorage();
  savePaymentIntent("order-1", { key: "processing-key" }, storage);

  assert.deepEqual(
    preparePaymentIntent("order-1", true, storage, () => "must-not-run"),
    { key: "processing-key" },
  );
  assert.deepEqual(
    preparePaymentIntent("order-1", false, storage, () => "fresh-key"),
    { key: "fresh-key" },
  );
  assert.equal(readPaymentIntent("order-1", storage)?.key, "fresh-key");
});

test("checkout resume is blocked when the current browser has no intent", () => {
  const storage = memoryStorage();
  assert.equal(preparePaymentIntent("order-2", true, storage), null);
});

test("gateway redirects accept HTTPS only", () => {
  assert.equal(
    parseHttpsPaymentUrl(
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=abc",
    ),
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=abc",
  );
  assert.equal(
    parseHttpsPaymentUrl("http://sandbox.vnpayment.vn/payment"),
    null,
  );
  assert.equal(parseHttpsPaymentUrl("javascript:alert(1)"), null);
  assert.equal(parseHttpsPaymentUrl("not-a-url"), null);
});

test("invalid stored payment intent is discarded", () => {
  const storage = memoryStorage();
  storage.setItem(paymentIntentKey("order-2"), "{");
  assert.equal(readPaymentIntent("order-2", storage), null);
  assert.equal(storage.values.has(paymentIntentKey("order-2")), false);
});

test("paid cart cleanup is scoped to the current payment intent", async () => {
  const storage = memoryStorage();
  let clearCalls = 0;
  const clear = async () => {
    clearCalls += 1;
    return true;
  };

  assert.equal(await clearCartAfterPaidOrder("old-order", clear, storage), false);
  assert.equal(clearCalls, 0);

  savePaymentIntent("current-order", { key: "current-key" }, storage);
  assert.equal(
    await clearCartAfterPaidOrder("current-order", async () => false, storage),
    false,
  );
  assert.equal(readPaymentIntent("current-order", storage)?.key, "current-key");

  assert.equal(
    await clearCartAfterPaidOrder("current-order", clear, storage),
    true,
  );
  assert.equal(clearCalls, 1);
  assert.equal(readPaymentIntent("current-order", storage), null);
});
