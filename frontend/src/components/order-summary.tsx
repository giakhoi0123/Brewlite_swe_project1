import type { CartItem } from "@/types/domain";
import { cartTotal, money } from "@/types/domain";
export function OrderSummary({
  items,
  discount = 0,
}: {
  items: CartItem[];
  discount?: number;
}) {
  const subtotal = cartTotal(items);
  return (
    <div>
      <h2 className="section-title" style={{ fontSize: 23 }}>
        Tóm tắt đơn hàng
      </h2>
      <div className="summary-line">
        <span>Tạm tính</span>
        <strong>{money(subtotal)}</strong>
      </div>
      {discount > 0 && (
        <div className="summary-line success">
          <span>Ưu đãi</span>
          <strong>−{money(discount)}</strong>
        </div>
      )}
      <div className="summary-line total">
        <span>Tổng cộng</span>
        <span>{money(Math.max(0, subtotal - discount))}</span>
      </div>
    </div>
  );
}
