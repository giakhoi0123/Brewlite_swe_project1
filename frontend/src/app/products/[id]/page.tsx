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
          <p>
            <Link href="/">Thực đơn</Link> / {product.name}
          </p>
          <div className="detail">
            <div>
              <ProductImage
                className="detail-image"
                src={product.imageUrl}
                alt={product.name}
              />
              <p className="muted">{product.description}</p>
            </div>
            <div className="card panel">
              <span className="eyebrow">{product.category}</span>
              <h1 className="section-title">{product.name}</h1>
              <p className="price">Từ {money(product.price)}</p>
              <h2>Kích cỡ ly</h2>
              <div className="options">
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
              <h2>Tùy chỉnh khẩu vị</h2>
              <p>Mức đá</p>
              <div className="options">
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
              <div className="options">
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
              <h2>Thêm topping đặc sản</h2>
              <div className="options">
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
