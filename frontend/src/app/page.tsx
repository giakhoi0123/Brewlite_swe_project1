"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { services } from "@/services";
import type { Product } from "@/types/domain";
import { money } from "@/types/domain";
import { Empty, ErrorState, Loading, ProductImage } from "@/components/ui";
import heroImages from "@/services/demo-image-urls.json";
export default function Home() {
  const [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Tất cả");
  const load = () => {
    setLoading(true);
    setError("");
    services.products
      .list()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const categories = ["Tất cả", ...new Set(products.map((p) => p.category))];
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "Tất cả" || p.category === category) &&
          p.name.toLowerCase().includes(query.toLowerCase().trim()),
      ),
    [products, category, query],
  );
  return (
    <main className="container main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow">● &nbsp; Tươi mới mỗi sớm mai</span>
          <h1 id="hero-title">
            Cà phê ngon, đặt nhanh <em>cùng BrewLite</em>
          </h1>
          <p>
            Chọn thức uống yêu thích, tùy chỉnh theo khẩu vị và thanh toán không
            tiền mặt chỉ trong vài bước.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#menu">Khám phá thực đơn <span aria-hidden="true">→</span></a>
            <Link className="btn btn-quiet" href="/cart">Xem giỏ hàng</Link>
          </div>
          <div className="hero-proof" aria-label="Điểm nổi bật">
            <span>✦ &nbsp; Robusta Việt Nam</span>
            <span>◷ &nbsp; Đặt món nhanh</span>
            <span>◇ &nbsp; Tùy chỉnh khẩu vị</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-photo hero-photo-main">
            <ProductImage src={heroImages[0]} alt="" />
            <span>Phin truyền thống <small>Đậm vị</small></span>
          </div>
          <div className="hero-photo hero-photo-accent">
            <ProductImage src={heroImages[1]} alt="" />
            <span>Espresso art</span>
          </div>
          <div className="hero-stamp">Hạt rang mới</div>
        </div>
      </section>
      <section id="menu" className="menu-section">
        <div className="menu-heading">
          <div>
            <span className="eyebrow">Chọn ly cà phê của bạn</span>
            <h2 className="section-title">Thực đơn BrewLite</h2>
          </div>
          <p>Cà phê quen vị, được pha theo cách bạn thích.</p>
        </div>
        <div className="menu-search">
          <span aria-hidden="true">⌕</span>
          <input
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm thức uống..."
            aria-label="Tìm thức uống"
          />
          <span className="menu-count">{filtered.length} thức uống</span>
        </div>
        <div className="filters">
          {categories.map((c) => (
            <button
              key={c}
              className={`pill ${category === c ? "active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={load} />
        ) : filtered.length === 0 ? (
          <Empty
            message="Không tìm thấy thức uống phù hợp."
            action={
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQuery("");
                  setCategory("Tất cả");
                }}
              >
                Xem tất cả đồ uống
              </button>
            }
          />
        ) : (
          <div className="grid">
            {filtered.map((p) => (
              <article className="card product-card" key={p.id}>
                <Link className="product-photo" href={`/products/${p.id}`} aria-label={`Xem ${p.name}`}>
                  <ProductImage src={p.imageUrl} alt="" />
                  <span className={`product-stock ${p.stock === 0 ? "is-out" : ""}`}>
                    {p.stock > 0 ? "● Còn hàng" : "● Tạm hết hàng"}
                  </span>
                </Link>
                <div className="product-body">
                  <span className="eyebrow">{p.category}</span>
                  <div className="product-heading"><h3>{p.name}</h3><span className="price">{money(p.price)}</span></div>
                  <p>{p.description}</p>
                  {p.stock > 0 ? (
                    <Link className="btn btn-secondary product-action" aria-label={`Tùy chỉnh ${p.name}`} href={`/products/${p.id}`}>
                      Xem chi tiết <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <span className="product-action unavailable">Tạm hết</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="member-promo">
        <div className="promo-icon" aria-hidden="true">✦</div>
        <div><h2>Tích điểm cho mỗi ly yêu thích</h2><p>Đăng ký thành viên BrewLite để theo dõi đơn hàng và điểm thưởng.</p></div>
        <Link className="btn btn-promo" href="/register">Đăng ký thành viên <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
