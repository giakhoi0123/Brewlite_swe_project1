"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/stores/cart";
import { useAuth } from "@/components/auth-provider";
import { OrderSummary } from "@/components/order-summary";
import { Empty, Loading, ProductImage } from "@/components/ui";
import { cartTotal, money } from "@/types/domain";
import type { PaymentMethod, Promotion } from "@/types/domain";
import { demoOrders, services } from "@/services";
import { savePaymentIntent } from "@/services/payment-intent";
export default function Checkout() {
  const router = useRouter(),
    items = useCart((s) => s.items),
    cartPromoCode = useCart((s) => s.promoCode),
    { user, loading } = useAuth(),
    [code, setCode] = useState(cartPromoCode),
    [promotion, setPromotion] = useState<Promotion | null>(null),
    [promoBusy, setPromoBusy] = useState(false),
    [busy, setBusy] = useState(false),
    [method, setMethod] = useState<PaymentMethod>("WALLET"),
    [outcome, setOutcome] = useState<"PAID" | "PAYMENT_FAILED" | "UNKNOWN">(
      "PAID",
    ),
    [error, setError] = useState("");
  const submitting = useRef(false);
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fcheckout");
  }, [loading, user, router]);
  // Mã đã áp dụng ở giỏ hàng được kiểm tra lại và áp dụng sẵn.
  useEffect(() => {
    if (!cartPromoCode || !items.length) return;
    services.promotions
      .validate(cartPromoCode, cartTotal(items))
      .then(setPromotion)
      .catch(() => setPromotion(null));
  }, [cartPromoCode, items]);
  const apply = async () => {
    setPromoBusy(true);
    setError("");
    try {
      setPromotion(await services.promotions.validate(code, cartTotal(items)));
    } catch (e) {
      setPromotion(null);
      setError(e instanceof Error ? e.message : "Mã không hợp lệ");
    } finally {
      setPromoBusy(false);
    }
  };
  const submit = async () => {
    if (!user || !items.length || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const order = await services.orders.create(
        user.id,
        items,
        promotion || undefined,
      );
      savePaymentIntent(order.id, {
        method,
        key: crypto.randomUUID(),
        ...(demoOrders ? { outcome } : {}),
      });
      router.push(`/payment/${encodeURIComponent(order.id)}/processing`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo đơn");
      submitting.current = false;
      setBusy(false);
    }
  };
  if (loading)
    return (
      <main className="container main">
        <Loading />
      </main>
    );
  if (!user)
    return (
      <main className="container main">
        <Loading label="Chuyển đến đăng nhập..." />
      </main>
    );
  return (
    <main className="container main">
      <h1 className="section-title">Thanh toán đơn hàng</h1>
      {items.length === 0 ? (
        <Empty
          message="Giỏ hàng trống."
          action={
            <Link className="btn btn-primary" href="/">
              Xem thực đơn
            </Link>
          }
        />
      ) : (
        <div className="two-col">
          <div className="stack">
            <section className="card panel">
              <h2>Hình thức nhận món & Người nhận</h2>
              <p>Nhận tại quầy BrewLite</p>
              <p className="muted">
                {user.name} · {user.email}
              </p>
            </section>
            <section className="card panel">
              <h2>
                Xem lại món đã chọn ({items.reduce((n, i) => n + i.quantity, 0)}{" "}
                món)
              </h2>
              {items.map((i) => (
                <div className="cart-row" key={i.key}>
                  <ProductImage src={i.imageUrl} alt={i.name} />
                  <div className="cart-row-main">
                    <strong>{i.name}</strong>
                    <p className="muted">
                      {i.size} · {i.ice} · {i.sugar} ·{" "}
                      {i.toppingNames.join(", ") || "Không topping"}
                    </p>
                  </div>
                  <strong>{money(i.unitPrice * i.quantity)}</strong>
                </div>
              ))}
            </section>
            <section className="card panel">
              <h2>Ưu đãi & Khuyến mãi</h2>
              <div className="row">
                <input
                  className="field"
                  aria-label="Mã ưu đãi"
                  placeholder="Nhập mã giảm giá"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setPromotion(null);
                  }}
                />
                <button
                  className="btn btn-secondary"
                  disabled={promoBusy || !code.trim()}
                  onClick={apply}
                >
                  {promoBusy ? "Đang kiểm tra..." : "Áp dụng"}
                </button>
              </div>
              {promotion && (
                <p className="success">
                  Đã áp dụng {promotion.code}: giảm {money(promotion.discount)}
                </p>
              )}
            </section>
            <section className="card panel">
              <h2>Phương thức thanh toán trực tuyến</h2>
              <div className="options">
                <button
                  className={`option ${method === "WALLET" ? "selected" : ""}`}
                  aria-pressed={method === "WALLET"}
                  onClick={() => setMethod("WALLET")}
                >
                  Ví điện tử
                </button>
                <button
                  className={`option ${method === "CARD" ? "selected" : ""}`}
                  aria-pressed={method === "CARD"}
                  onClick={() => setMethod("CARD")}
                >
                  Thẻ ngân hàng
                </button>
              </div>
              {demoOrders && (
                <div className="notice">
                  <strong>Kịch bản demo</strong>
                  <select
                    className="field"
                    aria-label="Kết quả thanh toán demo"
                    value={outcome}
                    onChange={(e) =>
                      setOutcome(e.target.value as typeof outcome)
                    }
                  >
                    <option value="PAID">Thành công</option>
                    <option value="PAYMENT_FAILED">Thất bại</option>
                    <option value="UNKNOWN">Chưa xác định</option>
                  </select>
                </div>
              )}
            </section>
          </div>
          <aside className="card panel">
            <OrderSummary items={items} discount={promotion?.discount || 0} />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 20 }}
              disabled={busy}
              onClick={submit}
            >
              {busy
                ? "Đang tạo đơn..."
                : `Xác nhận thanh toán ${money(Math.max(0, cartTotal(items) - (promotion?.discount || 0)))}`}
            </button>
            <p className="muted" style={{ fontSize: 12 }}>
              Số tiền cuối cùng được xác nhận khi tạo đơn hàng.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
