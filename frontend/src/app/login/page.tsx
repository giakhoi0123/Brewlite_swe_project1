"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth";
import { useAuth } from "@/components/auth-provider";
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
    <main className="container main">
      <div className="auth-wrap card panel">
        <span className="eyebrow">Chào mừng trở lại</span>
        <h1 className="section-title">Đăng nhập</h1>
        <form className="form" onSubmit={submit}>
          <label>
            Email
            <input
              className="field"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Mật khẩu
            <input
              className="field"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
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
