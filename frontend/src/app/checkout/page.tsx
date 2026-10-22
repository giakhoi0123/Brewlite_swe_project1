"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/stores/cart";
import { useAuth } from "@/components/auth-provider";
import { OrderSummary } from "@/components/order-summary";
import { Empty, Loading, ProductImage } from "@/components/ui";
import { cartTotal, money } from "@/types/domain";
import type { Order, Promotion } from "@/types/domain";
import { services } from "@/services";
import {
  preparePaymentIntent,
  readPaymentIntent,
} from "@/services/payment-intent";

function CheckoutContent() {
  const router = useRouter(),
    searchParams = useSearchParams(),
    retryOrderId = searchParams.get("retryOrder"),
    resumeOrderId = searchParams.get("resumeOrder"),
    existingOrderId = retryOrderId || resumeOrderId,
    items = useCart((s) => s.items),
    cartPromoCode = useCart((s) => s.promoCode),
    { user, loading } = useAuth(),
    [code, setCode] = useState(cartPromoCode),
    [promotion, setPromotion] = useState<Promotion | null>(null),
    [promoBusy, setPromoBusy] = useState(false),
    [busy, setBusy] = useState(false),
    [existingOrderLoading, setExistingOrderLoading] = useState(
      Boolean(existingOrderId),
    ),
    [existingOrder, setExistingOrder] = useState<Order | null>(null),
    [existingOrderReady, setExistingOrderReady] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fcheckout");
  }, [loading, user, router]);
  useEffect(() => {
    if (!existingOrderId || !user) {
      setExistingOrderLoading(false);
      return;
    }
    let active = true;
    setExistingOrderLoading(true);
    setExistingOrder(null);
    setExistingOrderReady(false);
    setError("");
    services.orders
      .get(existingOrderId)
      .then((order) => {
        if (!active) return;
        if (retryOrderId && resumeOrderId)
          throw new Error("Yêu cầu thanh toán lại không hợp lệ.");
        if (!order || order.userId !== user.id)
          throw new Error("Không tìm thấy đơn hàng cần tiếp tục thanh toán.");
        setExistingOrder(order);
        if (retryOrderId && order.status !== "PAYMENT_FAILED")
          throw new Error("Chỉ có thể thanh toán lại đơn đã thất bại.");
        if (resumeOrderId && order.status !== "PENDING")
          throw new Error("Đơn hàng không còn ở trạng thái chờ thanh toán.");
        if (resumeOrderId) {
          if (!readPaymentIntent(order.id))
            throw new Error(
              "Không tìm thấy phiên VNPAY hiện tại. Hãy kiểm tra trạng thái đơn trước khi thanh toán lại.",
            );
        }
        setExistingOrderReady(true);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Không tải được đơn hàng cần tiếp tục thanh toán.",
          );
      })
      .finally(() => {
        if (active) setExistingOrderLoading(false);
      });
    return () => {
      active = false;
    };
  }, [existingOrderId, resumeOrderId, retryOrderId, user]);
  const displayItems = existingOrder?.items || items;
  const displayDiscount = existingOrder
    ? existingOrder.discount
    : promotion?.discount || 0;
  const displayTotal =
    existingOrder?.total ?? Math.max(0, cartTotal(items) - displayDiscount);
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
    if (!user || !displayItems.length || submitting.current) return;
    if (existingOrderId && (!existingOrder || !existingOrderReady)) {
      setError("Không thể tiếp tục khi chưa tải được đơn hàng cũ.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const order =
        existingOrder ||
        (await services.orders.create(
          user.id,
          items,
          promotion || undefined,
        ));
      if (!preparePaymentIntent(order.id, Boolean(resumeOrderId)))
        throw new Error(
          "Phiên VNPAY hiện tại không còn khả dụng. Hãy kiểm tra trạng thái đơn.",
        );
      router.push(`/payment/${encodeURIComponent(order.id)}/processing`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo đơn");
      submitting.current = false;
      setBusy(false);
    }
  };
  if (loading || existingOrderLoading)
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
      {displayItems.length === 0 ? (
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
            {existingOrder && (
              <section className="notice" role="status">
                <strong>
                  {resumeOrderId ? "Tiếp tục" : "Thanh toán lại"} đơn #
                  {existingOrder.id}
                </strong>
                <p className="muted" style={{ fontSize: 12 }}>
                  {resumeOrderId
                    ? "Hệ thống giữ nguyên giao dịch đang chờ và sẽ mở lại trang chọn phương thức VNPAY."
                    : "Bạn đang dùng lại đơn hàng cũ; hệ thống sẽ không tạo thêm đơn mới."}
                </p>
              </section>
            )}
            <section className="card panel">
              <h2>Hình thức nhận món & Người nhận</h2>
              <p>Nhận tại quầy BrewLite</p>
              <p className="muted">
                {user.name} · {user.email}
              </p>
            </section>
            <section className="card panel">
              <h2>
                Xem lại món đã chọn ({displayItems.reduce((n, i) => n + i.quantity, 0)}{" "}
                món)
              </h2>
              {displayItems.map((i) => (
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
            {!existingOrder && <section className="card panel">
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
            </section>}
            <section className="card panel">
              <h2>Phương thức thanh toán trực tuyến</h2>
              <label className="vnpay-option selected">
                <input
                  type="radio"
                  name="payment-method"
                  value="VNPAY_QR"
                  checked
                  readOnly
                />
                <span className="vnpay-option-body">
                  <span className="vnpay-option-heading">
                    <strong>VNPAY-QR</strong>
                    <span className="vnpay-selected-badge">Đã chọn</span>
                  </span>
                  <span className="vnpay-option-copy">
                    Chọn QR hoặc phương thức TEST được terminal hỗ trợ trên cổng
                    VNPAY để hoàn tất thanh toán.
                  </span>
                  <span className="vnpay-option-meta">
                    VNPAY · Ngân hàng nội địa · Thanh toán mã hóa
                  </span>
                </span>
              </label>
              <div className="vnpay-secure-note">
                <span aria-hidden="true">🔒</span>
                <span>
                  Bạn sẽ được chuyển tới trang thanh toán VNPAY bảo mật. BrewLite
                  không lưu thông tin tài khoản ngân hàng. QR Sandbox không dùng
                  để trừ tiền từ ứng dụng ngân hàng thật.
                </span>
              </div>
            </section>
          </div>
          <aside className="card panel">
            <OrderSummary items={displayItems} discount={displayDiscount} />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 20 }}
              disabled={
                busy ||
                Boolean(existingOrderId && !existingOrderReady)
              }
              onClick={submit}
            >
              {busy
                ? existingOrder
                  ? resumeOrderId
                    ? "Đang mở lại VNPAY..."
                    : "Đang khởi tạo lại VNPAY..."
                  : "Đang khởi tạo VNPAY..."
                : `Thanh toán qua VNPAY ${money(displayTotal)}`}
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

export default function Checkout() {
  return (
    <Suspense
      fallback={
        <main className="container main">
          <Loading />
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
