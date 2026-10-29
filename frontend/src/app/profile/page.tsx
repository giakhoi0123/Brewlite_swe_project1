"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { services } from "@/services";
import { authService } from "@/services/auth";
import { REWARD_OPTIONS, type RewardOption, type Order, money } from "@/types/domain";
import type { UserVoucher } from "@/services/contracts";
import { ErrorState, Loading, StatusBadge } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import "./profile.css";

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

  // Form đổi mật khẩu
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const userId = user?.id;
  const userPoints = user?.loyaltyPoints;

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      await refresh();
      const [loyalty, mine, userVouchers] = await Promise.all([
        services.loyalty.get(userId).catch(() => ({ points: userPoints ?? 0 })),
        services.orders.mine(userId).catch(() => []),
        services.loyalty.vouchers ? services.loyalty.vouchers(userId).catch(() => []) : Promise.resolve([]),
      ]);

      const currentPoints =
        loyalty.points !== undefined ? loyalty.points : (userPoints ?? 0);
      setPoints(currentPoints);

      const sortedOrders = [...mine].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
      setOrders(sortedOrders);

      // Lưu voucher lấy trực tiếp từ PostgreSQL backend API
      setVouchers(userVouchers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được hồ sơ");
    } finally {
      setLoading(false);
    }
  }, [userId, refresh, userPoints]);

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
      if (typeof services.loyalty.redeem === "function") {
        const res = await services.loyalty.redeem(userId, { id: option.id });
        voucherCode = res.code;
      } else {
        throw new Error("Tính năng đổi điểm chưa sẵn sàng.");
      }

      if (!voucherCode) {
        throw new Error("Không nhận được mã ưu đãi từ hệ thống.");
      }

      setMessage({ type: "success", text: `Đổi thành công! Mã ưu đãi của bạn: ${voucherCode}` });
      await loadData();
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPwMessage({
        type: "error",
        text: "Mật khẩu mới phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa và 1 chữ số.",
      });
      return;
    }

    setPwBusy(true);
    try {
      const res = await authService.changePassword(oldPassword, newPassword);
      setPwMessage({ type: "success", text: res.message || "Đổi mật khẩu thành công!" });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Đổi mật khẩu thất bại.",
      });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <main className="container main member-main">
      {loading ? (
        <Loading label="Đang tải thông tin thành viên..." />
      ) : error ? (
        <ErrorState message={error} retry={loadData} />
      ) : user ? (
        <div className="member-grid">
          <section className="member-content">
            {message && (
              <div
                className={`p-4 rounded-lg mb-4 text-sm font-medium ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="card panel member-profile">
              <span className="eyebrow">Hồ sơ cá nhân</span>
              <div className="member-avatar">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
              <div>
                <h1>{user.name}</h1>
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

            {/* Mục đổi mật khẩu */}
            <section className="card panel mt-6">
              <span className="eyebrow">Bảo mật tài khoản</span>
              <h2>Đổi mật khẩu</h2>
              <p className="auth-intro text-sm text-gray-600 mb-4">
                Cập nhật mật khẩu thường xuyên để bảo vệ tài khoản của bạn.
              </p>

              {pwMessage && (
                <div
                  className={`p-3 rounded mb-4 text-sm ${
                    pwMessage.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {pwMessage.text}
                </div>
              )}

              <form className="form" onSubmit={handleChangePassword}>
                <PasswordField
                  label="Mật khẩu hiện tại"
                  value={oldPassword}
                  onChange={setOldPassword}
                  placeholder="Nhập mật khẩu hiện tại"
                  autoComplete="current-password"
                />
                <PasswordField
                  label="Mật khẩu mới"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Tối thiểu 8 ký tự, 1 chữ hoa, 1 số"
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Xác nhận mật khẩu mới"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                />
                <button className="btn btn-primary btn-sm mt-2" disabled={pwBusy}>
                  {pwBusy ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                </button>
              </form>
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
                      key={v.id || i}
                      className="voucher-item p-3 border rounded mb-2 bg-amber-50"
                    >
                      <div className="font-mono font-bold text-lg text-amber-900">
                        {v.code}
                      </div>
                      <div className="text-sm font-medium">{v.title}</div>
                      {v.minOrderValue && v.minOrderValue > 0 ? (
                        <div className="text-xs text-amber-700">
                          Áp dụng cho đơn từ {money(v.minOrderValue)}
                        </div>
                      ) : null}
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

              <span className="eyebrow mt-4 inline-block">Ưu đãi thành viên</span>
              <p className="mt-1">
                Các ưu đãi dành riêng cho bạn sẽ hiển thị tại đây khi đổi thành công. Bạn có thể nhập mã khuyến mãi ở bước thanh toán.
              </p>
              <Link className="btn btn-secondary mt-2 w-full text-center block" href="/cart">
                Đi tới giỏ hàng
              </Link>
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
