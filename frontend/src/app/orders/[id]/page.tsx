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
          {order.cancelReason && (
            <p className="muted" style={{ color: "#b91c1c", marginTop: 8 }}>
              Lý do hủy: {order.cancelReason}
            </p>
          )}
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
          {["PENDING", "PAYMENT_FAILED"].includes(order.status) && (
            <button
              className="btn btn-secondary"
              style={{ color: "#b91c1c", borderColor: "#fca5a5" }}
              onClick={async () => {
                if (window.confirm("Bạn có chắc chắn muốn hủy đơn hàng này?")) {
                  try {
                    if (services.orders.cancel) {
                      await services.orders.cancel(id, "Khách hàng yêu cầu hủy");
                      load();
                    }
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : "Không thể hủy đơn hàng");
                  }
                }
              }}
            >
              Hủy đơn hàng
            </button>
          )}
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
