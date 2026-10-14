"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/stores/cart";
import { useAuth } from "@/components/auth-provider";
import { Empty, ProductImage, Quantity } from "@/components/ui";
import { OrderSummary } from "@/components/order-summary";
import { money, lineTotal } from "@/types/domain";
export default function CartPage() {
  const { items, setQuantity, remove, clear } = useCart(),
    { user, loading } = useAuth(),
    router = useRouter();
  return (
    <main className="container main">
      <p className="breadcrumb"><Link href="/#menu">← Tiếp tục chọn món</Link><span>›</span> Chi tiết giỏ hàng</p>
      <div className="row cart-heading">
        <div><h1 className="section-title">Giỏ hàng của bạn</h1><p className="muted">{items.length === 0 ? "Chưa có món nào trong giỏ." : `Hiện có ${items.reduce((n, item) => n + item.quantity, 0)} món được chọn từ thực đơn.`}</p></div>
        {items.length > 0 && (
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm("Xóa tất cả món trong giỏ?")) clear();
            }}
          >
            Xóa tất cả
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <Empty
          message="Hãy chọn thức uống yêu thích từ thực đơn."
          action={
            <Link className="btn btn-primary" href="/">
              Khám phá thực đơn
            </Link>
          }
        />
      ) : (
        <div className="two-col">
          <div className="cart-list">
            {items.map((i) => (
              <div className="cart-row card" key={i.key}>
                <ProductImage src={i.imageUrl} alt={i.name} />
                <div className="cart-row-main">
                  <div className="row cart-item-heading"><strong>{i.name}</strong><strong>{money(lineTotal(i))}</strong></div>
                  <div className="cart-tags"><span>Size {i.size}</span><span>{i.ice}</span><span>{i.sugar}</span>{i.toppingNames.map((name) => <span key={name}>{name}</span>)}</div>
                  <div className="row cart-item-bottom">
                    <Quantity
                      value={i.quantity}
                      onChange={(n) => setQuantity(i.key, n)}
                    />
                    <button className="cart-remove" aria-label={`Xóa ${i.name}`} onClick={() => remove(i.key)}>Xóa món</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <aside className="card panel cart-summary">
            <span className="eyebrow">BrewLite Express</span>
            <OrderSummary items={items} />
            <p className="cart-summary-note">Giá và tồn kho sẽ được kiểm tra lại khi đặt đơn.</p>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 20 }}
              disabled={loading}
              onClick={() =>
                router.push(user ? "/checkout" : "/login?next=%2Fcheckout")
              }
            >
              Tiến hành thanh toán
            </button>
            <Link
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: 10 }}
              href="/"
            >
              Tiếp tục chọn món
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
