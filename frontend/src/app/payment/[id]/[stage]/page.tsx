"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services, demoOrders } from "@/services";
import { useCart } from "@/stores/cart";
import { useAuth } from "@/components/auth-provider";
import type { Order, PaymentMethod } from "@/types/domain";
import { money } from "@/types/domain";
import { ErrorState, Loading, StatusBadge } from "@/components/ui";
import {
  readPaymentIntent,
  removePaymentIntent,
  savePaymentIntent,
} from "@/services/payment-intent";
export default function PaymentPage({
  params,
}: {
  params: Promise<{ id: string; stage: string }>;
}) {
  const { id, stage } = use(params),
    router = useRouter(),
    { user, loading: authLoading } = useAuth(),
    clear = useCart((s) => s.clear),
    [order, setOrder] = useState<Order | null>(null),
    [loading, setLoading] = useState(true),
    [verifyBusy, setVerifyBusy] = useState(false),
    [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null),
    [error, setError] = useState("");
  const started = useRef(false);
  const load = useCallback(async () => {
    try {
      setOrder(await services.orders.get(id));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được đơn");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    if (!authLoading && !user)
      router.replace(
        `/login?next=${encodeURIComponent(`/payment/${id}/${stage}`)}`,
      );
    else if (user) void load();
  }, [authLoading, user, load, router, id, stage]);
  useEffect(() => {
    if (
      stage !== "processing" ||
      !order ||
      !user ||
      order.userId !== user.id ||
      started.current
    )
      return;
    const intent = readPaymentIntent(id);
    if (!intent) {
      router.replace(`/payment/${id}/unknown`);
      return;
    }
    setPaymentMethod(intent.method);
    started.current = true;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      router.replace(`/payment/${id}/unknown`);
    }, 15000);
    services.payments
      .pay(id, intent.method, intent.key, intent.outcome)
      .then(async (p) => {
        clearTimeout(timer);
        if (timedOut) return;
        if (p.status === "PAID") {
          removePaymentIntent(id);
          clear();
          router.replace(`/payment/${id}/success`);
        } else
          router.replace(
            `/payment/${id}/${p.status === "PAYMENT_FAILED" ? "failure" : "unknown"}`,
          );
      })
      .catch((e) => {
        clearTimeout(timer);
        if (timedOut) return;
        setError(
          e instanceof Error ? e.message : "Không xác minh được thanh toán",
        );
        router.replace(`/payment/${id}/unknown`);
      });
    return () => clearTimeout(timer);
  }, [stage, id, order, user, router, clear]);
  const verify = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    setError("");
    try {
      const current = await services.orders.get(id);
      setOrder(current);
      if (
        current &&
        ["PAID", "PREPARING", "READY", "COMPLETED"].includes(current.status)
      ) {
        removePaymentIntent(id);
        clear();
        router.replace(`/payment/${id}/success`);
      } else if (current?.status === "PAYMENT_FAILED")
        router.replace(`/payment/${id}/failure`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không kiểm tra được trạng thái đơn",
      );
    } finally {
      setVerifyBusy(false);
    }
  };
  const retry = () => {
    if (!order) return;
    started.current = false;
    const method =
      readPaymentIntent(id)?.method ||
      paymentMethod ||
      order.paymentMethod ||
      "WALLET";
    setPaymentMethod(method);
    savePaymentIntent(id, {
      method,
      key: crypto.randomUUID(),
      ...(demoOrders ? { outcome: "PAID" as const } : {}),
    });
    router.push(`/payment/${id}/processing`);
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
  return (
    <main className="container main">
      <div
        className="card panel"
        style={{ maxWidth: 680, margin: "auto", textAlign: "center" }}
      >
        {stage === "processing" ? (
          <>
            <div className="spinner" />
            <h1>Đang xử lý thanh toán...</h1>
            <p>Vui lòng chờ kết quả từ cổng thanh toán.</p>
            <p className="muted">Mã đơn #{order.id}</p>
            <strong>{money(order.total)}</strong>
          </>
        ) : stage === "success" &&
          ["PAID", "PREPARING", "READY", "COMPLETED"].includes(order.status) ? (
          <>
            <div style={{ fontSize: 50 }}>✓</div>
            <h1>Đặt hàng thành công!</h1>
            <StatusBadge status={order.status} />
            <p>
              Mã đơn <strong>#{order.id}</strong>
            </p>
            <div style={{ textAlign: "left" }}>
              {order.items.map((i) => (
                <div className="summary-line" key={i.key}>
                  <span>
                    {i.quantity} × {i.name} ({i.size})
                  </span>
                  <span>{money(i.quantity * i.unitPrice)}</span>
                </div>
              ))}
              <div className="summary-line total">
                <span>Tổng cộng</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
            <p>
              Phương thức:{" "}
              {(order.paymentMethod || paymentMethod) === "CARD"
                ? "Thẻ ngân hàng"
                : (order.paymentMethod || paymentMethod) === "WALLET"
                  ? "Ví điện tử"
                  : "Chưa xác định"}
            </p>
            <Link className="btn btn-primary" href="/orders">
              Xem đơn hàng
            </Link>
          </>
        ) : stage === "failure" && order.status === "PAYMENT_FAILED" ? (
          <>
            <h1 className="error">Thanh toán chưa thành công</h1>
            <StatusBadge status={order.status} />
            <p>{order.error || "Giao dịch demo bị từ chối."}</p>
            <p>Giỏ hàng vẫn được giữ nguyên.</p>
            <button className="btn btn-primary" onClick={retry}>
              Thử thanh toán lại
            </button>{" "}
            <Link className="btn btn-secondary" href="/cart">
              Về giỏ hàng
            </Link>
          </>
        ) : (
          <>
            <h1>Đang xác minh kết quả thanh toán</h1>
            <p>
              Chưa thể kết luận giao dịch. Kiểm tra trạng thái đơn trước khi thử
              lại.
            </p>
            {error && <p className="error">{error}</p>}
            <p>Mã đơn #{order.id}</p>
            <StatusBadge status={order.status} />
            <div style={{ marginTop: 22 }}>
              <button
                className="btn btn-secondary"
                disabled={verifyBusy}
                onClick={verify}
              >
                {verifyBusy ? "Đang kiểm tra..." : "Kiểm tra trạng thái đơn"}
              </button>{" "}
              <Link className="btn btn-outline" href={`/orders/${id}`}>
                Xem chi tiết đơn
              </Link>
            </div>
            {demoOrders && (
              <p className="muted" style={{ fontSize: 12 }}>
                Demo không tự chuyển trạng thái khi kết quả chưa rõ.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
