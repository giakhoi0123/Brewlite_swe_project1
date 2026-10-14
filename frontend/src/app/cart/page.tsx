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
      <div className="row">
        <h1 className="section-title">Giỏ hàng của bạn</h1>
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
          <div className="card">
            {items.map((i) => (
              <div className="cart-row" key={i.key}>
                <ProductImage src={i.imageUrl} alt={i.name} />
                <div className="cart-row-main">
                  <strong>{i.name}</strong>
                  <p className="muted" style={{ fontSize: 13 }}>
                    {i.size} · {i.ice} · {i.sugar}
                    {i.toppingNames.length > 0 &&
                      ` · ${i.toppingNames.join(", ")}`}
                  </p>
                  <div className="row">
                    <Quantity
                      value={i.quantity}
                      onChange={(n) => setQuantity(i.key, n)}
                    />
                    <strong>{money(lineTotal(i))}</strong>
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  aria-label={`Xóa ${i.name}`}
                  onClick={() => remove(i.key)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <aside className="card panel">
            <OrderSummary items={items} />
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
