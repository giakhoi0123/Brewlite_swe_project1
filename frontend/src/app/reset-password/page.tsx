"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authService } from "@/services/auth";
import { AuthFeature } from "@/components/auth-feature";
import { PasswordField } from "@/components/password-field";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Thiếu mã khôi phục. Vui lòng mở lại liên kết từ email.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Mật khẩu phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa và 1 chữ số.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await authService.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đặt lại mật khẩu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container main auth-main">
      <div className="auth-layout">
        <AuthFeature />
        <div className="auth-wrap card panel">
          <span className="eyebrow">Tài khoản BrewLite</span>
          <h1 className="section-title">Đặt lại mật khẩu</h1>
          <p className="auth-intro">
            Nhập mật khẩu mới an toàn cho tài khoản của bạn.
          </p>

          {!token ? (
            <div style={{ margin: "1.5rem 0", padding: "1rem", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b" }}>
              <p style={{ margin: 0, fontWeight: 500 }}>
                Không tìm thấy mã xác thực khôi phục mật khẩu.
              </p>
              <p style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.875rem" }}>
                Vui lòng kiểm tra lại liên kết trong email hoặc gửi lại yêu cầu.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <Link className="btn btn-secondary" href="/forgot-password">
                  Yêu cầu liên kết mới
                </Link>
              </div>
            </div>
          ) : success ? (
            <div style={{ margin: "1.5rem 0", padding: "1rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534" }}>
              <p style={{ margin: 0, fontWeight: 500 }}>
                Đặt lại mật khẩu thành công!
              </p>
              <p style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.875rem", color: "#15803d" }}>
                Tất cả phiên đăng nhập cũ đã được đăng xuất an toàn. Hãy đăng nhập với mật khẩu mới.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <Link className="btn btn-primary" href="/login">
                  Đăng nhập ngay
                </Link>
              </div>
            </div>
          ) : (
            <form className="form" onSubmit={submit}>
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
              <p style={{ fontSize: "0.8rem", color: "#78716c", marginTop: "-0.25rem", marginBottom: "0.5rem" }}>
                * Mật khẩu cần tối thiểu 8 ký tự, có ít nhất một chữ in hoa và một chữ số.
              </p>

              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}

              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Đang xử lý..." : "Lưu mật khẩu mới"}
              </button>
            </form>
          )}

          <p style={{ marginTop: "1.5rem" }}>
            Quay lại{" "}
            <Link className="link" href="/login">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function ResetPassword() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
