"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { services } from "@/services";
import type { Product } from "@/types/domain";
import { money } from "@/types/domain";
import { Empty, ErrorState, Loading, ProductImage } from "@/components/ui";
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
      <section className="hero">
        <span className="eyebrow">Chào mừng đến BrewLite</span>
        <h1>
          Cà phê ngon,
          <br />
          đặt nhanh mỗi ngày
        </h1>
        <p>
          Hương vị cà phê Việt được pha chế chỉn chu, sẵn sàng cho nhịp sống của
          bạn.
        </p>
        <a className="btn" href="#menu">
          Khám phá thực đơn ↓
        </a>
      </section>
      <section id="menu">
        <span className="eyebrow">Từ hạt cà phê đến ly yêu thích</span>
        <h2 className="section-title">Thực đơn BrewLite</h2>
        <input
          className="field"
          style={{ maxWidth: 420 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm thức uống..."
          aria-label="Tìm thức uống"
        />
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
                <Link href={`/products/${p.id}`}>
                  <ProductImage src={p.imageUrl} alt={p.name} />
                </Link>
                <div className="product-body">
                  <span className="eyebrow">{p.category}</span>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <div className="product-bottom">
                    <span className="price">{money(p.price)}</span>
                    {p.stock > 0 ? (
                      <Link
                        className="btn btn-primary"
                        aria-label={`Tùy chỉnh ${p.name}`}
                        href={`/products/${p.id}`}
                      >
                        Xem món
                      </Link>
                    ) : (
                      <span className="status CANCELLED">Tạm hết</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
