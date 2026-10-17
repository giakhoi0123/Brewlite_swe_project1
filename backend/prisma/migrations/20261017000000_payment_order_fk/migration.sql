-- Payments are only valid for persisted orders. This foreign key is added
-- after the Orders migration because the original Payments migration landed first.
ALTER TABLE payments
  ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
