"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { services } from "@/services";
import { ErrorState, Loading } from "@/components/ui";
export default function Profile() {
  const { user, loading: authLoading, refresh } = useAuth(),
    router = useRouter(),
    [points, setPoints] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const userId = user?.id;
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await refresh();
      setPoints((await services.loyalty.get(userId)).points);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được điểm");
    } finally {
      setLoading(false);
    }
  }, [userId, refresh]);
  useEffect(() => {
    if (!authLoading && !userId) router.replace("/login?next=%2Fprofile");
    else if (userId) void load();
  }, [authLoading, userId, router, load]);
  return (
    <main className="container main">
      <span className="eyebrow">BrewLite Rewards</span>
      <h1 className="section-title">Trung tâm Thành viên</h1>
      {authLoading || loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : (
        <div className="two-col">
          <section className="card panel">
            <h2>{user?.name}</h2>
            <p>{user?.email}</p>
            <p className="muted">
              Vai trò: {user?.role === "BARISTA" ? "Barista" : "Khách hàng"}
            </p>
            <Link className="btn btn-secondary" href="/orders">
              Xem đơn hàng của tôi
            </Link>
          </section>
          <section className="card panel">
            <span className="eyebrow">Điểm tích lũy</span>
            <h2 style={{ fontSize: 40, color: "var(--caramel)" }}>
              {points ?? 0} điểm
            </h2>
            <p className="muted">
              Điểm demo chỉ được ghi nhận sau khi đơn đã thanh toán thành công.
              Chính sách đổi điểm cần thống nhất với backend.
            </p>
            <button className="btn btn-secondary" onClick={load}>
              Làm mới điểm
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
