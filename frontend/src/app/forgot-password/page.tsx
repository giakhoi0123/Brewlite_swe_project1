"use client";
import { useState } from "react";
import Link from "next/link";
import { authService } from "@/services/auth";
import { AuthFeature } from "@/components/auth-feature";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await authService.forgotPassword(email);
      setSuccess(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi gửi yêu cầu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container main auth-main">
      <div className="auth-layout">
        <AuthFeature />
        <div className="auth-wrap card panel">
          <nav className="auth-tabs" aria-label="Tài khoản">
            <Link href="/login">Đăng nhập</Link>
            <span className="active">Quên mật khẩu</span>
          </nav>
          <span className="eyebrow">Khôi phục quyền truy cập</span>
          <h1 className="section-title">Quên mật khẩu</h1>
          <p className="auth-intro">
            Nhập email đã đăng ký. Chúng tôi sẽ gửi hướng dẫn khôi phục mật khẩu đến hòm thư của bạn.
          </p>

          {success ? (
            <div style={{ margin: "1.5rem 0", padding: "1rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534" }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{success}</p>
              <p style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.875rem", color: "#15803d" }}>
                Vui lòng kiểm tra hộp thư đến (hoặc thư rác) trong vòng 15 phút.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <Link className="btn btn-secondary" href="/login">
                  Quay lại đăng nhập
                </Link>
              </div>
            </div>
          ) : (
            <form className="form" onSubmit={submit}>
              <label>
                Email
                <input
                  className="field"
                  type="email"
                  required
                  placeholder="ban@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Đang gửi..." : "Gửi liên kết khôi phục"}
              </button>
            </form>
          )}

          <p style={{ marginTop: "1.5rem" }}>
            Nhớ mật khẩu?{" "}
            <Link className="link" href="/login">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

