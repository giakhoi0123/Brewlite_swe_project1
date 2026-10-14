"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { services } from "@/services";
import type { Order } from "@/types/domain";
import { money } from "@/types/domain";
import { ErrorState, Loading, StatusBadge, Timeline } from "@/components/ui";
export default function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    { user, loading: authLoading } = useAuth(),
    router = useRouter(),
    [order, setOrder] = useState<Order | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const userId = user?.id;
  const load = useCallback(() => {
    setLoading(true);
    services.orders
      .get(id)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    if (!authLoading && !userId)
      router.replace(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
    else if (userId) load();
  }, [authLoading, userId, id, router, load]);
  return (
    <main className="container main">
      <Link href="/orders">← Đơn hàng của tôi</Link>
      {loading || authLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : !order || order.userId !== user?.id ? (
        <ErrorState message="Không tìm thấy đơn hàng của bạn" />
      ) : (
        <div className="card panel" style={{ marginTop: 20 }}>
          <div className="row">
            <div>
              <span className="eyebrow">Chi tiết đơn hàng</span>
              <h1 className="section-title">Mã đơn #{order.id}</h1>
              <p className="muted">
                Tạo lúc {new Date(order.createdAt).toLocaleString("vi-VN")}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <Timeline status={order.status} />
          <h2>Các món đã chọn</h2>
          {order.items.map((i) => (
            <div className="summary-line" key={i.key}>
              <span>
                {i.quantity} × {i.name} · {i.size} ·{" "}
                {i.toppingNames.join(", ") || "Không topping"}
              </span>
              <strong>{money(i.unitPrice * i.quantity)}</strong>
            </div>
          ))}
          <div className="summary-line">
            <span>Tạm tính</span>
            <span>{money(order.subtotal)}</span>
          </div>
          <div className="summary-line">
            <span>Giảm giá</span>
            <span>−{money(order.discount)}</span>
          </div>
          <div className="summary-line total">
            <span>Tổng cộng</span>
            <span>{money(order.total)}</span>
          </div>
          <button className="btn btn-secondary" onClick={load}>
            Cập nhật trạng thái
          </button>
          {order.status === "PAYMENT_FAILED" && (
            <Link className="btn btn-primary" href={`/payment/${id}/failure`}>
              Thử thanh toán lại
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
