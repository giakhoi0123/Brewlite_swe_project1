import test from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_VERIFY_ATTEMPTS,
  PAYMENT_VERIFY_INTERVAL_MS,
  shouldReconcilePayment,
} from "./payment-verification";

test("payment verification retries QueryDR on a bounded backoff", () => {
  const scheduled = Array.from(
    { length: PAYMENT_VERIFY_ATTEMPTS },
    (_, index) => index + 1,
  ).filter(shouldReconcilePayment);

  assert.deepEqual(scheduled, [1, 4, 8, 12, 18, 24, 30]);
  assert.equal(PAYMENT_VERIFY_ATTEMPTS, 30);
  assert.equal(shouldReconcilePayment(0), false);
  assert.equal(shouldReconcilePayment(PAYMENT_VERIFY_ATTEMPTS + 1), false);
  assert.ok(PAYMENT_VERIFY_INTERVAL_MS >= 2_000);
});
