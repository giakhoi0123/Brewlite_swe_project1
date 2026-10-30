export const PAYMENT_VERIFY_ATTEMPTS = 30;
export const PAYMENT_VERIFY_INTERVAL_MS = 2_000;

// QueryDR can briefly return a signed "not ready" response just after the
// customer completes payment. Retry it on a bounded backoff while the faster
// Order polling still lets an IPN result win immediately.
const PAYMENT_RECONCILE_ATTEMPTS = new Set([1, 4, 8, 12, 18, 24, 30]);

export function shouldReconcilePayment(attempt: number): boolean {
  return (
    Number.isInteger(attempt) && PAYMENT_RECONCILE_ATTEMPTS.has(attempt)
  );
}
