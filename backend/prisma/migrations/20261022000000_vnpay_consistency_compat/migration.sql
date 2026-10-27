-- VNPAY keeps ambiguous attempts in PROCESSING and deliberately excludes
-- legacy UNKNOWN rows from the active-attempt constraint. This older index
-- came from the synchronous mock consistency migration and would otherwise
-- keep UNKNOWN rows blocking a new hosted VNPAY attempt.
DROP INDEX IF EXISTS "payments_one_live_attempt_per_order";
