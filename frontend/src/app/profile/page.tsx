"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { services } from "@/services";
import type { Order } from "@/types/domain";
import { money } from "@/types/domain";
import { ErrorState, Loading, StatusBadge } from "@/components/ui";
import "./profile.css";

export default function Profile() {
  const { user, loading: authLoading, refresh, logout } = useAuth();
  const router = useRouter();
  const [points, setPoints] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const userId = user?.id;
  const userPoints = user?.loyaltyPoints;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const [loyalty, mine] = await Promise.all([
        services.loyalty.get(userId).catch(() => ({ points: userPoints ?? 0 })),
        services.orders.mine(userId),
      ]);
      setPoints(loyalty.points ?? userPoints ?? 0);
      setOrders([...mine].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được hồ sơ");
    } finally {
      setLoading(false);
    }
  }, [userId, refresh, userPoints]);

  useEffect(() => {
    if (!authLoading && !userId) router.replace("/login?next=%2Fprofile");
    else if (userId) void load();
  }, [authLoading, userId, router, load]);

  return (
    <main className="container main member-page">
      <div className="breadcrumb"><Link href="/">Trang chủ</Link><span>›</span> Hồ sơ &amp; thẻ thành viên</div>
      <div className="member-heading">
        <div>
          <span className="eyebrow">Tài khoản cá nhân</span>
          <h1 className="section-title">Trung tâm Thành viên</h1>
          <p>Quản lý tài khoản, điểm BrewLite Rewards và các đơn hàng của bạn.</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading || !userId}>↻ Làm mới</button>
      </div>
      {authLoading || loading ? <Loading /> : error ? <ErrorState message={error} retry={load} /> : user ? (
        <div className="member-grid">
          <section className="member-main">
            <div className="member-identity card">
              <div className="member-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</div>
              <div className="member-identity-copy">
                <span className="eyebrow">Thành viên BrewLite</span>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
                <small>{user.role === "BARISTA" ? "Nhân viên Barista" : "Khách hàng"}</small>
              </div>
            </div>
            <div className="member-card">
              <div className="member-card-top"><div><span className="eyebrow">BrewLite Rewards</span><h2>Thẻ thành viên</h2></div><span className="member-card-symbol" aria-hidden="true">✦</span></div>
              <p className="member-card-points"><strong>{points ?? user.loyaltyPoints ?? 0}</strong> điểm</p>
              <p className="member-card-id">BL · {user.id.slice(0, 8).toUpperCase()}</p>
              <p className="member-card-note">Tài khoản BrewLite tự động tham gia tích điểm. Mỗi 10.000 ₫ của đơn hàng thanh toán thành công được 1 điểm.</p>
            </div>
            <section className="member-history card panel">
              <div className="member-section-head"><div><span className="eyebrow">Hoạt động gần đây</span><h2>Đơn hàng của tôi</h2></div><Link href="/orders">Xem tất cả →</Link></div>
              {orders.length === 0 ? <p className="muted">Bạn chưa có đơn hàng nào. <Link href="/#menu">Khám phá thực đơn</Link></p> : orders.slice(0, 3).map((order) => (
                <Link className="member-order" href={`/orders/${order.id}`} key={order.id}>
                  <div><strong>Đơn #{order.id}</strong><small>{new Date(order.createdAt).toLocaleString("vi-VN")} · {order.items.length} món</small></div>
                  <div><StatusBadge status={order.status} /><strong>{money(order.total)}</strong></div>
                </Link>
              ))}
            </section>
          </section>
          <aside className="member-side">
            <section className="card panel member-benefits">
              <span className="eyebrow">Ưu đãi thành viên</span>
              <h2>Kho voucher của tôi</h2>
              <p>Các ưu đãi dành riêng cho bạn sẽ hiển thị tại đây khi có. Bạn có thể nhập mã khuyến mãi ở bước thanh toán.</p>
              <Link className="btn btn-secondary" href="/cart">Đi tới giỏ hàng</Link>
            </section>
            <section className="card panel member-shortcuts">
              <h2>Thao tác nhanh</h2>
              <Link href="/orders">Lịch sử đơn hàng <span>→</span></Link>
              <Link href="/#menu">Tiếp tục khám phá món <span>→</span></Link>
              {user.role === "BARISTA" && <Link href="/barista/dashboard">Trạm Barista <span>→</span></Link>}
              <button onClick={async () => { await logout(); router.push("/"); }}>Đăng xuất tài khoản <span>→</span></button>
            </section>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
