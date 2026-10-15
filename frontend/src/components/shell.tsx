"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/stores/cart";
import { useAuth } from "./auth-provider";
import { dataMode } from "@/services";
export function Header() {
  const items = useCart((s) => s.items),
    { user, logout } = useAuth(),
    router = useRouter();
  const count = items.reduce((a, i) => a + i.quantity, 0);
  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 36 36" fill="none">
                <path d="M8 15h18v8a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8v-8Z" stroke="currentColor" strokeWidth="2" />
                <path d="M26 17h2a4 4 0 0 1 0 8h-2M7 31h22M14 5c-3 3 2 4-1 7M21 4c-3 3 2 5-1 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>BrewLite</span>
          </Link>
          <nav className="nav" aria-label="Điều hướng">
            <Link href="/">Trang chủ</Link>
            <Link href="/#menu">Thực đơn</Link>
            <Link href="/orders">Đơn hàng của tôi</Link>
            {user?.role === "BARISTA" && (
              <Link href="/barista/dashboard">Trạm Barista</Link>
            )}
          </nav>
          <div className="nav-tools">
            <Link className="cart-link" href="/cart" aria-label={`Giỏ hàng ${count} món`}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 8h16l-1.4 12H5.4L4 8ZM9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
              <span className="cart-label">Giỏ hàng</span>
              <span className="badge">{count}</span>
            </Link>
            {user ? (
              <>
                <Link href="/profile">{user.name}</Link>
                <button
                  className="link"
                  onClick={async () => {
                    await logout();
                    router.push("/");
                  }}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <Link href="/login">Đăng nhập</Link>
            )}
          </div>
        </div>
      </header>
      {dataMode === "mock" && (
        <div className="demo">
          Chế độ demo: sản phẩm, đơn hàng và thanh toán được mô phỏng. Đăng nhập
          dùng máy chủ thật.
        </div>
      )}
      {dataMode === "hybrid" && (
        <div className="demo">
          Sản phẩm, giỏ hàng và đăng nhập dùng máy chủ thật; đơn hàng và thanh
          toán đang được mô phỏng.
        </div>
      )}
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-about">
          <strong className="brand">BrewLite</strong>
          <p>Trải nghiệm cà phê Việt theo cách của bạn, từ chọn món đến đặt hàng chỉ trong vài bước.</p>
        </div>
        <div className="footer-links">
          <strong>Khám phá</strong>
          <Link href="/#menu">Thực đơn</Link>
          <Link href="/orders">Đơn hàng của tôi</Link>
          <Link href="/profile">Thành viên BrewLite</Link>
        </div>
        <div className="footer-links">
          <strong>Hỗ trợ</strong>
          <Link href="/cart">Giỏ hàng</Link>
          <Link href="/login">Tài khoản</Link>
        </div>
      </div>
      <div className="footer-bottom">© 2026 BrewLite · Cà phê Việt mỗi ngày</div>
    </footer>
  );
}
