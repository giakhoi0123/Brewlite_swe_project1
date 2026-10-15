"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/stores/cart";
import { useAuth } from "@/components/auth-provider";
import { ProductImage, Quantity } from "@/components/ui";
import { Icon } from "@/components/icons";
import { services } from "@/services";
import { cartTotal, lineTotal, money } from "@/types/domain";
import type { CartItem, Product, ProductSize, Promotion } from "@/types/domain";
const sizeLabel = (s: ProductSize) =>
  `Size: ${s.code} (${s.extraPrice > 0 ? `+${money(s.extraPrice)}` : "Tiêu chuẩn"})`;
function SizeControl({
  item,
  sizes,
  disabled,
  onChange,
}: {
  item: CartItem;
  sizes: ProductSize[];
  disabled: boolean;
  onChange: (size: ProductSize["code"], unitPrice: number) => void;
}) {
  const current = sizes.find((s) => s.code === item.size);
  if (!current) return <span className="ct-chip">Size: {item.size}</span>;
  return (
    <label className="ct-select">
      <span className="sr-only">Chọn size cho {item.name}</span>
      <select
        value={item.size}
        disabled={disabled}
        onChange={(e) => {
          const next = sizes.find((s) => s.code === e.target.value);
          if (next)
            onChange(next.code, item.unitPrice - current.extraPrice + next.extraPrice);
        }}
      >
        {sizes.map((s) => (
          <option key={s.code} value={s.code} disabled={!s.available}>
            {sizeLabel(s)}
          </option>
        ))}
      </select>
      <Icon name="down" size={16} />
    </label>
  );
}
export default function CartPage() {
  const {
      items,
      setQuantity,
      changeSize,
      remove,
      clear,
      promoCode,
      setPromoCode,
      owner,
      busy,
      error: cartError,
      dismissError,
    } = useCart(),
    { user, loading } = useAuth(),
    router = useRouter();
  const [products, setProducts] = useState<Product[]>([]),
    [code, setCode] = useState(""),
    [promotion, setPromotion] = useState<Promotion | null>(null),
    [promoError, setPromoError] = useState(""),
    [promoBusy, setPromoBusy] = useState(false);
  const count = items.reduce((n, i) => n + i.quantity, 0),
    subtotal = cartTotal(items),
    discount = Math.min(promotion?.discount || 0, subtotal),
    hasIssue = items.some((i) => i.issue);
  useEffect(() => {
    services.products
      .list()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);
  // Mã đã lưu được kiểm tra lại mỗi khi tạm tính thay đổi để ưu đãi luôn khớp giỏ.
  useEffect(() => {
    if (!promoCode || !subtotal) {
      setPromotion(null);
      return;
    }
    let active = true;
    services.promotions
      .validate(promoCode, subtotal)
      .then((p) => active && setPromotion(p))
      .catch((e) => {
        if (!active) return;
        setPromotion(null);
        setPromoCode("");
        setPromoError(e instanceof Error ? e.message : "Mã không hợp lệ");
      });
    return () => {
      active = false;
    };
  }, [promoCode, subtotal, setPromoCode]);
  const apply = async () => {
    setPromoBusy(true);
    setPromoError("");
    try {
      const p = await services.promotions.validate(code, subtotal);
      setPromotion(p);
      setPromoCode(p.code);
      setCode("");
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : "Mã không hợp lệ");
    } finally {
      setPromoBusy(false);
    }
  };
  return (
    <main className="container ct-page">
      <nav className="ct-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Trang chủ</Link>
        <Icon name="chevron" size={14} />
        <Link href="/#menu">Menu</Link>
        <Icon name="chevron" size={14} />
        <strong>Giỏ hàng của bạn</strong>
      </nav>
      <div className="ct-header">
        <div>
          <div className="ct-title-row">
            <h1>Giỏ hàng của bạn</h1>
            <span className="ct-count">{count} sản phẩm</span>
          </div>
          <p>
            Cà phê rang mộc thủ công, pha chế ngay khi nhận đơn.
            {owner ? " Giỏ được lưu theo tài khoản của bạn." : ""}
          </p>
        </div>
        {items.length > 0 && (
          <button
            className="ct-clear"
            onClick={() => {
              if (confirm("Xóa tất cả món trong giỏ?")) clear();
            }}
          >
            <Icon name="sweep" size={18} />
            Xóa tất cả
          </button>
        )}
      </div>
      {cartError && (
        <div className="ct-alert" role="alert">
          <span>{cartError}</span>
          <button aria-label="Đóng thông báo" onClick={dismissError}>
            ×
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <div className="ct-empty">
          <span>
            <Icon name="bag" size={40} />
          </span>
          <h2>Giỏ hàng đang trống</h2>
          <p>Hãy chọn thức uống yêu thích từ thực đơn để bắt đầu.</p>
          <Link className="ct-primary" href="/#menu">
            Khám phá thực đơn <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      ) : (
        <div className={`ct-layout ${busy ? "is-busy" : ""}`} aria-busy={busy}>
          <section className="ct-list">
            {items.map((i) => {
              const product = products.find((p) => p.id === i.productId);
              return (
                <article className="cart-row ct-item" key={i.key}>
                  <Link href={`/products/${i.productId}`} className="ct-thumb">
                    <ProductImage src={i.imageUrl} alt={i.name} />
                    {product && <span>{product.category}</span>}
                  </Link>
                  <div className="ct-item-main">
                    <div className="ct-item-head">
                      <h2>{i.name}</h2>
                      <button
                        className="ct-remove"
                        aria-label={`Xóa ${i.name}`}
                        onClick={() => remove(i.key)}
                      >
                        <Icon name="trash" size={20} />
                      </button>
                    </div>
                    <div className="ct-options">
                      <SizeControl
                        item={i}
                        sizes={i.sizeOptions ?? product?.sizes ?? []}
                        disabled={busy}
                        onChange={(size, unit) => changeSize(i.key, size, unit)}
                      />
                      <span className="ct-chip">
                        <Icon name="plusCircle" size={15} />
                        <span>
                          Topping:{" "}
                          {i.toppingNames.length
                            ? i.toppingNames.join(", ")
                            : "Không topping"}
                        </span>
                      </span>
                    </div>
                    <div className="ct-note">
                      <Icon name="tune" size={14} />
                      <span>
                        {i.ice}, {i.sugar}
                        {i.note ? ` · Ghi chú: ${i.note}` : ""}
                      </span>
                    </div>
                    {i.issue && <p className="ct-issue">{i.issue}</p>}
                    <div className="ct-item-bottom">
                      <div>
                        <small>Đơn giá</small>
                        <strong>{money(i.unitPrice)}</strong>
                      </div>
                      <div className="ct-item-right">
                        <Quantity
                          value={i.quantity}
                          onChange={(n) => setQuantity(i.key, n)}
                        />
                        <div className="ct-line-total">
                          <small>Thành tiền</small>
                          <strong>{money(lineTotal(i))}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            <div className="ct-promise">
              <span>
                <Icon name="truck" size={20} />
              </span>
              <div>
                <strong>Đóng gói giữ nhiệt & niêm phong chống đổ tràn</strong>
                <p>Ly giấy tráng sáp thực vật thân thiện môi trường, đá riêng theo yêu cầu của bạn.</p>
              </div>
            </div>
          </section>
          <aside className="ct-summary">
            <div className="ct-summary-head">
              <h2>Tóm tắt đơn hàng</h2>
              <Icon name="receipt" size={20} />
            </div>
            <div className="ct-lines">
              <div>
                <span>Tạm tính</span>
                <strong>{money(subtotal)}</strong>
              </div>
              {promotion && discount > 0 && (
                <div className="ct-discount">
                  <span>
                    Ưu đãi <em>{promotion.code}</em>
                  </span>
                  <strong>− {money(discount)}</strong>
                  <button
                    aria-label="Bỏ mã ưu đãi"
                    onClick={() => setPromoCode("")}
                  >
                    ×
                  </button>
                </div>
              )}
              <div>
                <span>
                  Phí phục vụ
                  <small>Nhận món tại quầy BrewLite</small>
                </span>
                <strong className="ct-free">Miễn phí</strong>
              </div>
            </div>
            <div className="ct-grand">
              <span>
                Tổng cộng
                <small>Giá cuối cùng được xác nhận khi đặt đơn</small>
              </span>
              <strong>{money(subtotal - discount)}</strong>
            </div>
            <div className="ct-voucher">
              <label htmlFor="voucher-input">Mã ưu đãi / Voucher</label>
              <div>
                <input
                  id="voucher-input"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setPromoError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && code.trim()) apply();
                  }}
                  placeholder="Nhập mã (VD: BREW10)"
                />
                <button disabled={promoBusy || !code.trim()} onClick={apply}>
                  {promoBusy ? "Đang kiểm tra" : "Áp dụng"}
                </button>
              </div>
              {promoError && <p className="error">{promoError}</p>}
              {promotion && (
                <p className="success">Đã áp dụng {promotion.code}.</p>
              )}
            </div>
            {hasIssue && (
              <p className="error ct-summary-note">
                Vui lòng chỉnh các món được đánh dấu trước khi đặt hàng.
              </p>
            )}
            <button
              className="ct-primary"
              disabled={loading || busy || hasIssue}
              onClick={() =>
                router.push(user ? "/checkout" : "/login?next=%2Fcheckout")
              }
            >
              Tiến hành đặt hàng <Icon name="arrowRight" size={18} />
            </button>
            <Link className="ct-continue" href="/#menu">
              <Icon name="arrowLeft" size={16} /> Tiếp tục chọn đồ uống
            </Link>
            <div className="ct-perks">
              <span>
                <Icon name="bolt" size={20} /> Pha ngay khi đặt
              </span>
              <span>
                <Icon name="snow" size={20} /> Giữ trọn vị
              </span>
              <span>
                <Icon name="tag" size={20} /> Tích điểm thành viên
              </span>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
