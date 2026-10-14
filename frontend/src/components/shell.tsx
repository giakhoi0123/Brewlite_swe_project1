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
            ☕ BrewLite
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
            <Link href="/cart" aria-label={`Giỏ hàng ${count} món`}>
              Giỏ hàng <span className="badge">{count}</span>
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
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong className="brand">BrewLite</strong>
          <p>Cà phê Việt, tiện lợi mỗi ngày.</p>
        </div>
        <div>
          <Link href="/">Thực đơn</Link> · <Link href="/orders">Đơn hàng</Link>{" "}
          · <Link href="/profile">Thành viên</Link>
        </div>
        <small>© 2026 BrewLite</small>
      </div>
    </footer>
  );
}
