"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/services";
import { useCart } from "@/stores/cart";
import type { Product, ProductSize } from "@/types/domain";
import { itemKey, money } from "@/types/domain";
import { ErrorState, Loading, ProductImage, Quantity } from "@/components/ui";
export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    router = useRouter(),
    add = useCart((s) => s.add);
  const [product, setProduct] = useState<Product | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [size, setSize] = useState<ProductSize["code"]>("S"),
    [selected, setSelected] = useState<string[]>([]),
    [quantity, setQuantity] = useState(1),
    [ice, setIce] = useState("100% đá"),
    [sugar, setSugar] = useState("100% chuẩn");
  const load = useCallback(() => {
    setLoading(true);
    services.products
      .get(id)
      .then((p) => {
        setProduct(p);
        setSize(p?.sizes.find((s) => s.isDefault)?.code || "S");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const chosenSize = product?.sizes.find((s) => s.code === size);
  const chosenToppings = useMemo(
    () => product?.toppings.filter((t) => selected.includes(t.id)) || [],
    [product, selected],
  );
  const unit =
    (product?.price || 0) +
    (chosenSize?.extraPrice || 0) +
    chosenToppings.reduce((n, t) => n + t.extraPrice, 0);
  const invalid =
    !!product &&
    (!chosenSize?.available || chosenToppings.some((t) => !t.available));
  const submit = () => {
    if (!product || invalid || product.stock < quantity) return;
    add({
      key: itemKey(product.id, size, selected, ice, sugar),
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      size,
      toppingIds: selected,
      toppingNames: chosenToppings.map((t) => t.name),
      unitPrice: unit,
      quantity,
      ice,
      sugar,
    });
    router.push("/cart");
  };
  return (
    <main className="container main">
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : !product ? (
        <ErrorState message="Không tìm thấy sản phẩm" />
      ) : (
        <>
          <p className="breadcrumb">
            <Link href="/">Trang chủ</Link> <span>›</span> <Link href="/#menu">Thực đơn BrewLite</Link> <span>›</span> {product.name}
          </p>
          <div className="detail">
            <div className="detail-media">
              <div className="detail-photo">
                <ProductImage
                  className="detail-image"
                  src={product.imageUrl}
                  alt={product.name}
                />
                <span className="detail-photo-tag">BrewLite Signature</span>
                <div className="detail-photo-caption"><small>Công thức được yêu thích</small><strong>{product.name}</strong></div>
              </div>
              <div className="detail-story">
                <span className="eyebrow">Câu chuyện hương vị</span>
                <p>{product.description}</p>
              </div>
            </div>
            <div className="detail-config">
              <span className="detail-category">{product.category}</span>
              <h1 className="section-title">{product.name}</h1>
              <p className="price">Từ {money(product.price)}</p>
              <p className="detail-description">{product.description}</p>
              <div className="detail-section">
              <h2>Kích cỡ ly <small>Chọn 1 kích cỡ</small></h2>
              <div className="options size-options">
                {product.sizes.map((s) => (
                  <button
                    key={s.code}
                    disabled={!s.available}
                    className={`option ${size === s.code ? "selected" : ""}`}
                    onClick={() => setSize(s.code)}
                  >
                    {s.code} · {s.name}{" "}
                    {s.extraPrice > 0 && `+${money(s.extraPrice)}`}
                  </button>
                ))}
              </div>
              </div>
              <div className="detail-section taste-section">
              <h2>Tùy chỉnh khẩu vị</h2>
              <p>Mức đá</p>
              <div className="options taste-options">
                {["100% đá", "70% đá", "30% đá", "Không đá"].map((x) => (
                  <button
                    key={x}
                    className={`option ${ice === x ? "selected" : ""}`}
                    onClick={() => setIce(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <p>Mức đường</p>
              <div className="options taste-options">
                {[
                  "100% chuẩn",
                  "70% ngọt vừa",
                  "50% ít ngọt",
                  "Không đường",
                ].map((x) => (
                  <button
                    key={x}
                    className={`option ${sugar === x ? "selected" : ""}`}
                    onClick={() => setSugar(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              </div>
              <div className="detail-section">
              <h2>Thêm topping đặc sản</h2>
              <div className="options topping-options">
                {product.toppings.map((t) => (
                  <label
                    key={t.id}
                    className={`option ${selected.includes(t.id) ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      disabled={!t.available}
                      checked={selected.includes(t.id)}
                      onChange={() =>
                        setSelected((v) =>
                          v.includes(t.id)
                            ? v.filter((x) => x !== t.id)
                            : [...v, t.id],
                        )
                      }
                    />{" "}
                    {t.name} +{money(t.extraPrice)}
                  </label>
                ))}
              </div>
              </div>
              <div className="detail-summary">
              <div className="row">
                <span>Số lượng</span>
                <Quantity value={quantity} onChange={setQuantity} />
              </div>
              {product.stock === 0 && (
                <p className="error">Món này đang hết hàng.</p>
              )}
              {product.stock > 0 && quantity > product.stock && (
                <p className="error">Chỉ còn {product.stock} phần.</p>
              )}
              {invalid && <p className="error">Tùy chọn không hợp lệ.</p>}
              <hr />
              <div className="row">
                <strong>Tổng cộng</strong>
                <strong className="price">{money(unit * quantity)}</strong>
              </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 20 }}
                disabled={
                  product.stock === 0 || product.stock < quantity || invalid
                }
                onClick={submit}
              >
                Thêm vào giỏ hàng
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
