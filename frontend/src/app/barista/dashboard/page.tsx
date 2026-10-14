"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { services } from "@/services";
import type { Order, OrderStatus } from "@/types/domain";
import { money } from "@/types/domain";
import { ErrorState, Loading, StatusBadge } from "@/components/ui";
const columns: [OrderStatus, string, OrderStatus][] = [
  ["PAID", "Chờ pha chế", "PREPARING"],
  ["PREPARING", "Đang pha chế", "READY"],
  ["READY", "Sẵn sàng giao", "COMPLETED"],
];
export default function Barista() {
  const { user, loading: authLoading } = useAuth(),
    router = useRouter(),
    [orders, setOrders] = useState<Order[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const userId = user?.id;
  const role = user?.role;
  const load = useCallback(() => {
    setLoading(true);
    services.barista
      .list()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!authLoading && !userId)
      router.replace("/login?next=%2Fbarista%2Fdashboard");
    else if (role !== "BARISTA" && !authLoading)
      router.replace("/forbidden");
    else if (userId) load();
  }, [authLoading, userId, role, router, load]);
  const transition = async (o: Order, next: OrderStatus) => {
    if (!confirm(`Chuyển đơn ${o.id} sang ${next}?`)) return;
    setBusy(o.id);
    try {
      await services.barista.transition(o.id, next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật");
    } finally {
      setBusy("");
    }
  };
  return (
    <main className="container main">
      <div className="row">
        <div>
          <span className="eyebrow">BrewLite KDS · Trạm Barista</span>
          <h1 className="section-title">Bảng điều khiển pha chế</h1>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          Làm mới
        </button>
      </div>
      {authLoading || loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : (
        <div className="barista-columns">
          {columns.map(([status, label, next], i) => (
            <section className="barista-column" key={status}>
              <h2>
                {i + 1}. {label} ({status})
              </h2>
              {orders.filter((o) => o.status === status).length === 0 ? (
                <p className="muted">Chưa có đơn.</p>
              ) : (
                orders
                  .filter((o) => o.status === status)
                  .map((o) => (
                    <article
                      className="card panel"
                      key={o.id}
                      style={{ marginBottom: 12 }}
                    >
                      <div className="row">
                        <strong>#{o.id}</strong>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="muted">
                        {new Date(o.createdAt).toLocaleTimeString("vi-VN")}
                      </p>
                      {o.items.map((item) => (
                        <p key={item.key}>
                          {item.quantity} × {item.name} ({item.size})<br />
                          <small>
                            {item.ice}, {item.sugar},{" "}
                            {item.toppingNames.join(", ")}
                          </small>
                        </p>
                      ))}
                      <strong>{money(o.total)}</strong>
                      <div className="stack" style={{ marginTop: 15 }}>
                        <button
                          className="btn btn-primary"
                          disabled={busy === o.id}
                          onClick={() => transition(o, next)}
                        >
                          {next === "PREPARING"
                            ? "Bắt đầu pha chế"
                            : next === "READY"
                              ? "Hoàn tất pha chế"
                              : "Đã giao khách"}
                        </button>
                        {status === "PAID" && (
                          <button
                            className="btn btn-danger"
                            disabled={busy === o.id}
                            onClick={() => transition(o, "CANCELLED")}
                          >
                            Hủy đơn sự cố
                          </button>
                        )}
                      </div>
                    </article>
                  ))
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
