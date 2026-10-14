"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { services } from "@/services";
import type { Order } from "@/types/domain";
import { money } from "@/types/domain";
import { Empty, ErrorState, Loading, StatusBadge } from "@/components/ui";
export default function Orders() {
  const { user, loading: authLoading } = useAuth(),
    router = useRouter(),
    [orders, setOrders] = useState<Order[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const userId = user?.id;
  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    services.orders
      .mine(userId)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);
  useEffect(() => {
    if (!authLoading && !userId) router.replace("/login?next=%2Forders");
    else if (userId) load();
  }, [authLoading, userId, router, load]);
  return (
    <main className="container main">
      <div className="row">
        <h1 className="section-title">Đơn hàng của tôi</h1>
        <button
          className="btn btn-secondary"
          onClick={load}
          disabled={!user || loading}
        >
          Làm mới
        </button>
      </div>
      {authLoading || loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : orders.length === 0 ? (
        <Empty
          message="Bạn chưa có đơn hàng nào."
          action={
            <Link className="btn btn-primary" href="/">
              Đặt món ngay
            </Link>
          }
        />
      ) : (
        <div className="stack">
          {orders.map((o) => (
            <Link className="card panel" key={o.id} href={`/orders/${o.id}`}>
              <div className="row">
                <div>
                  <h2 style={{ margin: 0 }}>Mã đơn #{o.id}</h2>
                  <p className="muted">
                    {new Date(o.createdAt).toLocaleString("vi-VN")} ·{" "}
                    {o.items.reduce((n, i) => n + i.quantity, 0)} món
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="row">
                <span>{o.items.map((i) => i.name).join(", ")}</span>
                <strong>{money(o.total)}</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
