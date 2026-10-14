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
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const next = params.get("next");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setError("Mật khẩu cần ít nhất 8 ký tự, 1 chữ hoa và 1 chữ số");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await authService.register(name, email, password);
      await refresh();
      router.replace(
        next?.startsWith("/") && !next.startsWith("//") ? next : "/",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="container main">
      <div className="auth-wrap card panel">
        <span className="eyebrow">Gia nhập BrewLite</span>
        <h1 className="section-title">Tạo tài khoản mới</h1>
        <form className="form" onSubmit={submit}>
          <label>
            Họ tên
            <input
              className="field"
              minLength={2}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
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
              autoComplete="new-password"
            />
          </label>
          <label>
            Xác nhận mật khẩu
            <input
              className="field"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Đang tạo tài khoản..." : "Đăng ký"}
          </button>
        </form>
        <p>
          Đã có tài khoản? <Link href="/login">Đăng nhập ngay</Link>
        </p>
      </div>
    </main>
  );
}
export default function Register() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
