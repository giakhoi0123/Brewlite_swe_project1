"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth";
import { useAuth } from "@/components/auth-provider";
import { AuthFeature } from "@/components/auth-feature";
import { PasswordField } from "@/components/password-field";
function Form() {
  const router = useRouter(),
    params = useSearchParams(),
    { refresh } = useAuth(),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const next = params.get("next");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await authService.login(email, password);
      await refresh();
      router.replace(
        user.role === "BARISTA"
          ? "/barista/dashboard"
          : next?.startsWith("/") && !next.startsWith("//")
            ? next
            : "/",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
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
          <span className="active">Đăng nhập</span>
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Đăng ký</Link>
        </nav>
        <span className="eyebrow">Chào mừng trở lại</span>
        <h1 className="section-title">Đăng nhập</h1>
        <p className="auth-intro">Đăng nhập tài khoản để tiếp tục hành trình cà phê của bạn.</p>
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
          <PasswordField label="Mật khẩu" value={password} onChange={setPassword} placeholder="Nhập mật khẩu" autoComplete="current-password" />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-8px", marginBottom: "8px" }}>
            <Link className="link" href="/forgot-password" style={{ fontSize: "0.875rem" }}>
              Quên mật khẩu?
            </Link>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <p>
          Chưa có tài khoản?{" "}
          <Link
            className="link"
            href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          >
            Đăng ký ngay
          </Link>
        </p>
        </div>
      </div>
    </main>
  );
}
export default function Login() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
