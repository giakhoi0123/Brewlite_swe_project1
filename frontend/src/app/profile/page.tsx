"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { services } from "@/services";
import { REWARD_OPTIONS, type RewardOption, type Order, money } from "@/types/domain";
import { ErrorState, Loading, StatusBadge } from "@/components/ui";
import "./profile.css";

interface UserVoucher {
  code: string;
  title: string;
  discountAmount: number;
  isUsed?: boolean;
  createdAt: string;
}

export default function Profile() {
  const { user, loading: authLoading, refresh, logout } = useAuth();
  const router = useRouter();
  const [points, setPoints] = useState<number>(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vouchers, setVouchers] = useState<UserVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const userId = user?.id;

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      await refresh();
      const [loyalty, mine] = await Promise.all([
        services.loyalty.get(userId).catch(() => ({ points: user?.loyaltyPoints ?? 0 })),
        services.orders.mine(userId).catch(() => []),
      ]);

      // Cập nhật điểm chuẩn xác từ CSDL backend
      const currentPoints = loyalty.points !== undefined 
        ? loyalty.points 
        : (user?.loyaltyPoints ?? 0);

      setPoints(currentPoints);
      
      const sortedOrders = [...mine].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setOrders(sortedOrders);

      // 💡 BƯỚC QUAN TRỌNG: Lấy tập hợp các mã đã sử dụng trong danh sách đơn hàng
      const usedCodesSet = new Set(
        sortedOrders
          .filter((o) => o.status !== "CANCELLED" && o.status !== "PAYMENT_FAILED" && o.promotionCode)
          .map((o) => o.promotionCode!.trim().toUpperCase())
      );

      // Đọc kho voucher cá nhân từ localStorage
      const savedVouchers: UserVoucher[] = JSON.parse(
        localStorage.getItem(`vouchers_${userId}`) || "[]"
      );

      // Cập nhật trạng thái isUsed = true cho mã nào đã có trong đơn hàng
      const updatedVouchers = savedVouchers.map((v) => {
        const codeUpper = v.code.trim().toUpperCase();
        if (usedCodesSet.has(codeUpper)) {
          return { ...v, isUsed: true };
        }
        return v;
      });

      // Lưu lại vào localStorage để đồng bộ
      localStorage.setItem(`vouchers_${userId}`, JSON.stringify(updatedVouchers));

      // 💡 CHỈ GIỮ LẠI VOUCHER CHƯA SỬ DỤNG ĐỂ HIỂN THỊ
      const activeVouchers = updatedVouchers.filter((v) => !v.isUsed);
      setVouchers(activeVouchers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được hồ sơ");
    } finally {
      setLoading(false);
    }
  }, [userId, refresh, user?.loyaltyPoints]);

  useEffect(() => {
    if (!authLoading && !userId) router.replace("/login?next=%2Fprofile");
    else if (userId) void loadData();
  }, [authLoading, userId, router, loadData]);

  const handleRedeem = async (option: RewardOption) => {
    if (!userId) return;
    if (points < option.pointsCost) {
      setMessage({ type: "error", text: `Bạn không đủ điểm để đổi ${option.title}!` });
      return;
    }

    setRedeemingId(option.id);
    setMessage(null);

    try {
      let voucherCode = "";
      let remainingPoints = points - option.pointsCost;

      // 1. Gọi API Backend để trừ điểm thật trong PostgreSQL
      if (typeof services.loyalty.redeem === "function") {
        const res: any = await services.loyalty.redeem(userId, option as any);
        voucherCode = res?.code || res?.couponCode || res?.voucher?.code || "";
        if (res?.remainingPoints !== undefined) {
          remainingPoints = res.remainingPoints;
        }
      } else {
        const kilo = Math.round(option.discountAmount / 1000);
        voucherCode = `REDEEM${kilo}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }

      if (!voucherCode) {
        throw new Error("Không nhận được mã ưu đãi từ hệ thống.");
      }

      // 2. Lưu voucher mới đổi vào LocalStorage
      const savedVouchers: UserVoucher[] = JSON.parse(
        localStorage.getItem(`vouchers_${userId}`) || "[]"
      );

      const newVoucher: UserVoucher = {
        code: voucherCode,
        title: option.title,
        discountAmount: option.discountAmount,
        isUsed: false,
        createdAt: new Date().toISOString(),
      };

      const updatedVouchers = [newVoucher, ...savedVouchers];
      localStorage.setItem(`vouchers_${userId}`, JSON.stringify(updatedVouchers));

      // 3. Cập nhật State chỉ lấy các voucher chưa dùng
      setVouchers(updatedVouchers.filter((v) => !v.isUsed));
      setPoints(remainingPoints);
      setMessage({ type: "success", text: `Đổi thành công! Mã ưu đãi của bạn: ${voucherCode}` });

      // Đồng bộ dữ liệu với server
      await refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Đổi điểm thất bại.",
      });
    } finally {
      setRedeemingId(null);
    }
  };

  const handleUseVoucher = (code: string) => {
    navigator.clipboard.writeText(code);
    setMessage({ type: "success", text: `Đã sao chép mã ${code} vào bộ nhớ tạm!` });
    router.push("/cart");
  };

  return (
    <main className="container main member-page">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span>›</span> Hồ sơ &amp; thẻ thành viên
      </div>

      <div className="member-heading">
        <div>
          <span className="eyebrow">Tài khoản cá nhân</span>
          <h1 className="section-title">Trung tâm Thành viên</h1>
          <p>Quản lý tài khoản, điểm BrewLite Rewards và các đơn hàng của bạn.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading || !userId}>
          ↻ Làm mới
        </button>
      </div>

      {message && (
        <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"} mb-4`}>
          {message.text}
        </div>
      )}

      {authLoading || loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={loadData} />
      ) : user ? (
        <div className="member-grid">
          <section className="member-main">
            <div className="member-identity card">
              <div className="member-avatar" aria-hidden="true">
                {user.name.trim().charAt(0).toUpperCase()}
              </div>
              <div className="member-identity-copy">
                <span className="eyebrow">Thành viên BrewLite</span>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
                <small>{user.role === "BARISTA" ? "Nhân viên Barista" : "Khách hàng"}</small>
              </div>
            </div>

            <div className="member-card">
              <div className="member-card-top">
                <div>
                  <span className="eyebrow">BrewLite Rewards</span>
                  <h2>Thẻ thành viên</h2>
                </div>
              </div>
              <p className="member-card-points">
                <strong>{points}</strong> điểm
              </p>
              <p className="member-card-id">BL · {user.id.slice(0, 8).toUpperCase()}</p>
              <p className="member-card-note">
                Tích 1 điểm cho mỗi 10.000đ khi hoàn tất đơn hàng thành công.
              </p>
            </div>

            <section className="card panel mt-6">
              <span className="eyebrow">Đổi điểm nhận ưu đãi</span>
              <h2>Gói quà BrewLite Rewards</h2>
              <div className="reward-options-grid mt-4">
                {REWARD_OPTIONS.map((opt) => {
                  const canRedeem = points >= opt.pointsCost;
                  return (
                    <div key={opt.id} className="reward-card p-4 border rounded-lg mb-3 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold">{opt.title}</h3>
                        <p className="text-sm text-gray-600">{opt.description}</p>
                        <span className="badge badge-amber mt-1 inline-block">{opt.pointsCost} điểm</span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!canRedeem || redeemingId === opt.id}
                        onClick={() => handleRedeem(opt)}
                      >
                        {redeemingId === opt.id ? "Đang đổi..." : canRedeem ? "Đổi ngay" : "Chưa đủ điểm"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="member-history card panel mt-6">
              <div className="member-section-head">
                <div>
                  <span className="eyebrow">Hoạt động gần đây</span>
                  <h2>Đơn hàng của tôi</h2>
                </div>
                <Link href="/orders">Xem tất cả →</Link>
              </div>
              {orders.length === 0 ? (
                <p className="muted">
                  Bạn chưa có đơn hàng nào. <Link href="/#menu">Khám phá thực đơn</Link>
                </p>
              ) : (
                orders.slice(0, 3).map((order) => (
                  <Link className="member-order" href={`/orders/${order.id}`} key={order.id}>
                    <div>
                      <strong>Đơn #{order.id}</strong>
                      <small>
                        {new Date(order.createdAt).toLocaleString("vi-VN")} · {order.items.length} món
                      </small>
                    </div>
                    <div>
                      <StatusBadge status={order.status} />
                      <strong>{money(order.total)}</strong>
                    </div>
                  </Link>
                ))
              )}
            </section>
          </section>

          <aside className="member-side">
            <section className="card panel member-benefits">
              <span className="eyebrow">Ưu đãi của bạn</span>
              <h2>Kho voucher của tôi ({vouchers.length})</h2>
              {vouchers.length === 0 ? (
                <p className="muted">Bạn chưa có voucher khả dụng nào.</p>
              ) : (
                <div className="voucher-list mt-3">
                  {vouchers.map((v, i) => (
                    <div
                      key={i}
                      className="voucher-item p-3 border rounded mb-2 bg-amber-50"
                    >
                      <div className="font-mono font-bold text-lg text-amber-900">
                        {v.code}
                      </div>
                      <div className="text-sm">{v.title}</div>
                      <button
                        className="btn btn-secondary btn-xs mt-2 w-full"
                        onClick={() => handleUseVoucher(v.code)}
                      >
                        Sao chép &amp; Sử dụng ➔
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card panel member-shortcuts">
              <h2>Thao tác nhanh</h2>
              <Link href="/orders">
                Lịch sử đơn hàng <span>→</span>
              </Link>
              <Link href="/#menu">
                Tiếp tục khám phá món <span>→</span>
              </Link>
              {user.role === "BARISTA" && (
                <Link href="/barista/dashboard">
                  Trạm Barista <span>→</span>
                </Link>
              )}
              <button
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
              >
                Đăng xuất tài khoản <span>→</span>
              </button>
            </section>
          </aside>
        </div>
      ) : null}
    </main>
  );
}