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
type Intent = {
  method: PaymentMethod;
  key: string;
  outcome?: "PAID" | "PAYMENT_FAILED" | "UNKNOWN";
};
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
    if (!authLoading && !user) router.replace(`/login?next=${encodeURIComponent(`/payment/${id}/${stage}`)}`);
    else if (user) void load();
  }, [authLoading, user, load, router, id, stage]);
  useEffect(() => {
    if (stage !== "processing" || !order || !user || order.userId !== user.id || started.current) return;
    const raw = sessionStorage.getItem(`brewlite-payment-${id}`);
    if (!raw) {
      router.replace(`/payment/${id}/unknown`);
      return;
    }
    const intent = JSON.parse(raw) as Intent;
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
        sessionStorage.removeItem(`brewlite-payment-${id}`);
        if (p.status === "PAID") {
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
    const current = await services.orders.get(id);
    setOrder(current);
    if (current && ["PAID", "PREPARING", "READY", "COMPLETED"].includes(current.status)) {
      clear();
      router.replace(`/payment/${id}/success`);
    } else if (current?.status === "PAYMENT_FAILED") router.replace(`/payment/${id}/failure`);
  };
  const retry = () => {
    if (!order) return;
    started.current = false;
    const method = order.paymentMethod || "WALLET";
    sessionStorage.setItem(
      `brewlite-payment-${id}`,
      JSON.stringify({ method, key: crypto.randomUUID(), outcome: "PAID" }),
    );
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
              {order.paymentMethod === "CARD" ? "Thẻ ngân hàng" : "Ví điện tử"}
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
            <button className="btn btn-secondary" onClick={verify}>
                Kiểm tra trạng thái đơn
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
