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
    <main className="container main auth-main">
      <div className="auth-layout">
        <AuthFeature />
        <div className="auth-wrap card panel">
        <nav className="auth-tabs" aria-label="Tài khoản">
          <Link href="/login">Đăng nhập</Link>
          <span className="active">Đăng ký</span>
        </nav>
        <span className="eyebrow">Gia nhập BrewLite</span>
        <h1 className="section-title">Tạo tài khoản mới</h1>
        <p className="auth-intro">Tạo tài khoản để đặt món nhanh hơn và theo dõi đơn hàng của bạn.</p>
        <form className="form" onSubmit={submit}>
          <label>
            Họ tên
            <input
              className="field"
              minLength={2}
              required
              placeholder="Tên của bạn"
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
              placeholder="ban@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <PasswordField label="Mật khẩu" value={password} onChange={setPassword} placeholder="Nhập mật khẩu" autoComplete="new-password" hint="Ít nhất 8 ký tự, gồm chữ hoa và chữ số." />
          <PasswordField label="Xác nhận mật khẩu" value={confirmPassword} onChange={setConfirmPassword} placeholder="Nhập lại mật khẩu" autoComplete="new-password" />
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
