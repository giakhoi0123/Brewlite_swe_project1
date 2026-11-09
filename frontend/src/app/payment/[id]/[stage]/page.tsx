"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState, Loading, StatusBadge } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { services } from "@/services";
import {
  clearCartAfterPaidOrder,
  parseHttpsPaymentUrl,
  readPaymentIntent,
  removePaymentIntent,
} from "@/services/payment-intent";
import {
  PAYMENT_VERIFY_ATTEMPTS,
  PAYMENT_VERIFY_INTERVAL_MS,
  shouldReconcilePayment,
} from "@/services/payment-verification";
import { useCart } from "@/stores/cart";
import { money } from "@/types/domain";
import type { Order, OrderStatus, Payment } from "@/types/domain";

const PAID_ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
];
const isPaidOrder = (status: OrderStatus) =>
  PAID_ORDER_STATUSES.includes(status);

export default function PaymentPage({
  params,
}: {
  params: Promise<{ id: string; stage: string }>;
}) {
  const { id, stage } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const clear = useCart((state) => state.clear);
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [error, setError] = useState("");
  const processingStarted = useRef(false);
  const verificationStarted = useRef(false);
  const paidCartCleared = useRef(false);
  const orderOwnerId = order?.userId;
  const currentUserId = user?.id;

  const load = useCallback(async () => {
    try {
      setOrder(await services.orders.get(id));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được đơn");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const clearPaidCart = useCallback(async () => {
    if (paidCartCleared.current) return true;
    paidCartCleared.current = true;
    try {
      const cleared = await clearCartAfterPaidOrder(id, clear);
      if (!cleared) paidCartCleared.current = false;
      return cleared;
    } catch {
      paidCartCleared.current = false;
      return false;
    }
  }, [clear, id]);

  const routeFromTrustedOrder = useCallback(
    async (current: Order) => {
      if (isPaidOrder(current.status)) {
        await clearPaidCart();
        router.replace(`/payment/${encodeURIComponent(id)}/success`);
        return true;
      }
      if (
        current.status === "PAYMENT_FAILED" ||
        current.status === "CANCELLED"
      ) {
        removePaymentIntent(id);
        router.replace(`/payment/${encodeURIComponent(id)}/failure`);
        return true;
      }
      return false;
    },
    [clearPaidCart, id, router],
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(
        `/login?next=${encodeURIComponent(`/payment/${id}/${stage}`)}`,
      );
    } else if (user) {
      void load();
    }
  }, [authLoading, user, load, router, id, stage]);

  useEffect(() => {
    if (
      stage !== "processing" ||
      !orderOwnerId ||
      !currentUserId ||
      orderOwnerId !== currentUserId ||
      processingStarted.current
    ) {
      return;
    }

    const intent = readPaymentIntent(id);
    if (!intent) {
      router.replace(`/payment/error?orderId=${encodeURIComponent(id)}`);
      return;
    }

    processingStarted.current = true;
    let active = true;

    void services.payments
      .pay(id, intent.method, intent.key)
      .then(async (payment) => {
        if (!active) return;
        setPayment(payment);

        // Mock mode may finish immediately. Always confirm against the owned
        // Order before clearing the cart or showing a terminal result.
        if (payment.status !== "PROCESSING") {
          const current = await services.orders.get(id);
          if (!active) return;
          if (current && current.userId === currentUserId) {
            const terminal = await routeFromTrustedOrder(current);
            if (terminal) return;
          }
          router.replace(`/payment/${encodeURIComponent(id)}/unknown`);
          return;
        }

        if (payment.method === "ADMIN_APPROVAL") {
          router.replace(`/payment/${encodeURIComponent(id)}/pending-admin`);
          return;
        }

        const paymentUrl = parseHttpsPaymentUrl(payment.paymentUrl);
        if (!paymentUrl) {
          router.replace(`/payment/error?orderId=${encodeURIComponent(id)}`);
          return;
        }

        window.location.assign(paymentUrl);
      })
      .catch(() => {
        if (active)
          router.replace(`/payment/error?orderId=${encodeURIComponent(id)}`);
      });

    return () => {
      active = false;
      processingStarted.current = false;
    };
  }, [stage, id, orderOwnerId, currentUserId, router, routeFromTrustedOrder]);

  useEffect(() => {
    if (
      stage !== "pending-admin" ||
      !orderOwnerId ||
      !currentUserId ||
      orderOwnerId !== currentUserId
    ) {
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const [currentOrder, currentPayment] = await Promise.all([
          services.orders.get(id),
          services.payments.get(id),
        ]);
        if (!active) return;
        if (!currentOrder || currentOrder.userId !== currentUserId) {
          router.replace("/payment/error");
          return;
        }
        setOrder(currentOrder);
        setPayment(currentPayment);
        if (await routeFromTrustedOrder(currentOrder)) return;
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không đọc được yêu cầu thanh toán",
          );
      }
      if (active) timer = setTimeout(poll, 3000);
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [stage, id, orderOwnerId, currentUserId, router, routeFromTrustedOrder]);

  useEffect(() => {
    if (
      stage !== "verifying" ||
      !order ||
      !user ||
      order.userId !== user.id ||
      verificationStarted.current
    ) {
      return;
    }

    verificationStarted.current = true;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = () =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, PAYMENT_VERIFY_INTERVAL_MS);
      });

    void (async () => {
      for (
        let attempt = 1;
        attempt <= PAYMENT_VERIFY_ATTEMPTS && active;
        attempt += 1
      ) {
        setPollAttempt(attempt);
        try {
          if (shouldReconcilePayment(attempt)) {
            try {
              // QueryDR may briefly report "not ready" after the app has
              // completed payment. Bounded retries recover a delayed result
              // without opening another payment attempt.
              await services.payments.reconcile(id);
            } catch {
              // Keep polling the trusted Order because IPN may still arrive.
            }
          }
          const current = await services.orders.get(id);
          if (!active) return;
          if (!current || current.userId !== user.id) {
            router.replace("/payment/error");
            return;
          }
          if (await routeFromTrustedOrder(current)) return;
        } catch {
          // IPN và Order có thể chưa đồng bộ hoặc mạng có thể chập chờn; thử
          // lại trong giới hạn bên dưới rồi chuyển sang trạng thái chưa rõ.
        }
        if (attempt < PAYMENT_VERIFY_ATTEMPTS) await wait();
      }
      if (active)
        router.replace(`/payment/${encodeURIComponent(id)}/unknown`);
    })();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      verificationStarted.current = false;
    };
  }, [stage, id, order, user, router, routeFromTrustedOrder]);

  useEffect(() => {
    if (
      stage === "success" &&
      order &&
      user &&
      order.userId === user.id &&
      isPaidOrder(order.status)
    ) {
      void clearPaidCart();
    }
  }, [stage, order, user, clearPaidCart]);

  useEffect(() => {
    if (
      stage !== "failure" ||
      !orderOwnerId ||
      !currentUserId ||
      orderOwnerId !== currentUserId
    )
      return;
    let active = true;
    void services.payments
      .get(id)
      .then((current) => {
        if (active) setPayment(current);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [stage, id, orderOwnerId, currentUserId]);

  const verify = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    setError("");
    try {
      try {
        if (payment?.method === "ADMIN_APPROVAL" || stage === "pending-admin")
          setPayment(await services.payments.get(id));
        else await services.payments.reconcile(id);
      } catch {
        // A throttled/unavailable QueryDR must not hide an IPN result that may
        // already have reached the Order endpoint.
      }
      const current = await services.orders.get(id);
      if (!current || current.userId !== user?.id) {
        setError("Không tìm thấy đơn hàng");
        return;
      }
      const terminal = await routeFromTrustedOrder(current);
      if (!terminal) setOrder(current);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không kiểm tra được trạng thái đơn",
      );
    } finally {
      setVerifyBusy(false);
    }
  };

  const retry = () => {
    if (order?.status !== "PAYMENT_FAILED") return;
    router.push(`/checkout?retryOrder=${encodeURIComponent(id)}`);
  };

  const resume = () => {
    if (order?.status !== "PENDING") return;
    router.push(`/checkout?resumeOrder=${encodeURIComponent(id)}`);
  };

  if (loading || authLoading)
    return (
      <main className="container main">
        <Loading />
      </main>
    );

  if (error && stage !== "unknown")
    return (
      <main className="container main">
        <ErrorState message={error} retry={load} />
      </main>
    );

  if (!order || order.userId !== user?.id)
    return (
      <main className="container main">
        <ErrorState message="Không tìm thấy đơn hàng" />
      </main>
    );

  const paid = isPaidOrder(order.status);
  const failed = ["PAYMENT_FAILED", "CANCELLED"].includes(order.status);

  return (
    <main className="container main payment-main">
      <section className="card payment-state-card" aria-live="polite">
        {stage === "processing" ? (
          <>
            <div className="payment-orbit" aria-hidden="true">
              <span className="spinner" />
            </div>
            <p className="payment-eyebrow">Kết nối cổng thanh toán</p>
            <h1>Đang chuyển đến VNPAY...</h1>
            <p className="payment-lead">
              BrewLite đang tạo giao dịch bảo mật. Mã QR sẽ được hiển thị trên
              trang thanh toán chính thức của VNPAY.
            </p>
            <div className="payment-order-chip">
              <span>Mã đơn #{order.id}</span>
              <strong>{money(order.total)}</strong>
            </div>
          </>
        ) : stage === "pending-admin" ? (
          <>
            <div className="payment-result-icon is-unknown" aria-hidden="true">
              ⏳
            </div>
            <p className="payment-eyebrow">Yêu cầu đã gửi đến Admin</p>
            <h1>Đang chờ quản trị viên xử lý</h1>
            <p className="payment-lead">
              Admin sẽ quyết định yêu cầu này Thành công hoặc Thất bại. Đơn
              hàng vẫn ở trạng thái chờ và chưa được gửi tới quầy pha chế.
            </p>
            <div className="payment-order-chip">
              <span>Mã đơn #{order.id}</span>
              <strong>{money(order.total)}</strong>
            </div>
            <div className="payment-actions">
              <button
                className="btn btn-primary"
                disabled={verifyBusy}
                onClick={verify}
              >
                {verifyBusy ? "Đang kiểm tra..." : "Kiểm tra kết quả"}
              </button>
              <Link className="btn btn-outline" href={`/orders/${id}`}>
                Xem chi tiết đơn
              </Link>
            </div>
          </>
        ) : stage === "verifying" ? (
          <>
            <div className="payment-orbit" aria-hidden="true">
              <span className="spinner" />
            </div>
            <p className="payment-eyebrow">Xác thực giao dịch</p>
            <h1>Đang xác minh thanh toán</h1>
            <p className="payment-lead">
              Chúng tôi đang chờ xác nhận an toàn từ máy chủ VNPAY. Vui lòng
              không đóng trang này hoặc thanh toán lại.
            </p>
            <div className="payment-order-chip">
              <span>Mã đơn #{order.id}</span>
              <strong>{money(order.total)}</strong>
            </div>
            <p className="payment-poll-copy">
              Lần kiểm tra {Math.max(1, pollAttempt)}/
              {PAYMENT_VERIFY_ATTEMPTS}
            </p>
          </>
        ) : stage === "success" && paid ? (
          <>
            <div className="payment-result-icon is-success" aria-hidden="true">
              ✓
            </div>
            <p className="payment-eyebrow">Giao dịch đã xác thực</p>
            <h1>Đặt hàng thành công!</h1>
            <StatusBadge status={order.status} />
            <p className="payment-lead">
              Cảm ơn bạn đã lựa chọn BrewLite. Đơn hàng đã được gửi đến quầy
              pha chế.
            </p>
            <div className="payment-receipt">
              <div className="payment-receipt-heading">
                <span>Mã đơn #{order.id}</span>
                <strong>Đã thanh toán</strong>
              </div>
              {order.items.map((item) => (
                <div className="summary-line" key={item.key}>
                  <span>
                    {item.quantity} × {item.name} ({item.size})
                  </span>
                  <span>{money(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
              <div className="summary-line total">
                <span>Tổng cộng</span>
                <span>{money(order.total)}</span>
              </div>
              <p>
                Phương thức: {order.paymentMethod === "ADMIN_APPROVAL" ? "Admin xác nhận" : "VNPAY-QR"}
              </p>
            </div>
            <div className="payment-actions">
              <Link className="btn btn-primary" href="/orders">
                Theo dõi đơn hàng
              </Link>
              <Link className="btn btn-secondary" href="/">
                Tiếp tục đặt món
              </Link>
            </div>
          </>
        ) : stage === "failure" && failed ? (
          <>
            <div className="payment-result-icon is-failure" aria-hidden="true">
              ×
            </div>
            <p className="payment-eyebrow">Giao dịch chưa hoàn tất</p>
            <h1>Thanh toán chưa thành công</h1>
            <StatusBadge status={order.status} />
            <p className="payment-lead">
              {order.status === "CANCELLED"
                ? "Đơn hàng này đã bị hủy."
                : payment?.method === "ADMIN_APPROVAL"
                  ? payment.reviewNote ||
                    "Admin đã đánh dấu yêu cầu thanh toán là Thất bại."
                  : order.error ||
                    "Yêu cầu thanh toán chưa thành công. Giỏ hàng của bạn vẫn được giữ nguyên."}
            </p>
            <div className="payment-actions">
              {order.status === "PAYMENT_FAILED" && (
                <button className="btn btn-primary" onClick={retry}>
                  Thử thanh toán lại
                </button>
              )}
              <Link className="btn btn-secondary" href="/cart">
                Về giỏ hàng
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="payment-result-icon is-unknown" aria-hidden="true">
              ?
            </div>
            <p className="payment-eyebrow">Cần thêm thời gian xác minh</p>
            <h1>Chưa xác định kết quả thanh toán</h1>
            <p className="payment-lead">
              Giao dịch chưa có kết quả cuối cùng. Bạn có thể kiểm tra lại trạng
              thái hoặc quay về bước chọn phương thức để tiếp tục đúng yêu cầu
              hiện tại.
            </p>
            {error && <p className="error">{error}</p>}
            <div className="payment-order-chip">
              <span>Mã đơn #{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <div className="payment-actions">
              {order.status === "PENDING" && (
                <button className="btn btn-primary" onClick={resume}>
                  Thử lại
                </button>
              )}
              <button
                className="btn btn-secondary"
                disabled={verifyBusy}
                onClick={verify}
              >
                {verifyBusy ? "Đang kiểm tra..." : "Kiểm tra trạng thái đơn"}
              </button>
              <Link className="btn btn-outline" href={`/orders/${id}`}>
                Xem chi tiết đơn
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
