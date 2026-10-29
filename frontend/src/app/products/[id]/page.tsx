"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/services";
import { useCart } from "@/stores/cart";
import type { CartItemInput, Product, ProductPreviewResult, ProductSize } from "@/types/domain";
import { itemKey, money } from "@/types/domain";
import { ErrorState, Loading, ProductImage, Quantity } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

const ICE = ["100% đá", "70% đá", "30% đá", "Không đá"],
  SUGAR = ["100% chuẩn", "70% ngọt vừa", "50% ít ngọt", "Không đường"],
  VOLUME: Record<ProductSize["code"], string> = { S: "250ml", M: "350ml", L: "500ml" };

type Story = {
  chips: [IconName, string][];
  cards: [IconName, string, string][];
  scores: [string, number][];
};

const stories: Record<string, Story> = {
  "Cà phê Phin": {
    chips: [["cup", "Pha phin truyền thống"], ["leaf", "Robusta & Arabica"], ["bolt", "Đậm đà caffeine"]],
    cards: [
      ["beans", "Thành phần", "Hạt Robusta Buôn Ma Thuột kết hợp Arabica Cầu Đất, sữa đặc và đá viên tinh khiết."],
      ["pin", "Nguồn gốc nông trại", "Đắk Lắk & Lâm Đồng — vùng đất đỏ bazan cho hạt chắc, hương đậm."],
      ["spark", "Hương vị chủ đạo", "Đắng thanh của Robusta rang vừa, hậu vị caramen ngọt dịu cùng sữa đặc."],
      ["bulb", "Gợi ý thưởng thức", "Dùng ngon nhất trong 20 phút sau khi pha, khuấy đều từ đáy ly."],
    ],
    scores: [["Độ đậm", 9], ["Độ béo ngọt", 7.5], ["Hương thơm", 8.5]],
  },
  "Cà phê Máy": {
    chips: [["cup", "Chiết xuất espresso"], ["leaf", "Arabica tuyển chọn"], ["bolt", "Cân bằng caffeine"]],
    cards: [
      ["beans", "Thành phần", "Espresso double shot từ hạt Arabica rang mộc, kết hợp sữa tươi đánh mịn."],
      ["pin", "Nguồn gốc nông trại", "Cầu Đất, Lâm Đồng — độ cao trên 1.500m cho vị chua thanh tự nhiên."],
      ["spark", "Hương vị chủ đạo", "Hương hạt dẻ, chocolate đen và hậu vị ngọt nhẹ kéo dài."],
      ["bulb", "Gợi ý thưởng thức", "Thưởng thức ngay để giữ trọn lớp crema và nhiệt độ lý tưởng."],
    ],
    scores: [["Độ đậm", 7.5], ["Độ béo ngọt", 6.5], ["Hương thơm", 9]],
  },
  default: {
    chips: [["leaf", "Nguyên liệu tươi"], ["cup", "Pha chế thủ công"], ["spark", "Thanh mát"]],
    cards: [
      ["beans", "Thành phần", "Nguyên liệu tuyển chọn trong ngày, pha chế thủ công theo công thức BrewLite."],
      ["pin", "Nguồn gốc", "Trà và trái cây từ các nhà vườn Việt Nam, kiểm soát chất lượng từng mẻ."],
      ["spark", "Hương vị chủ đạo", "Thanh mát, cân bằng giữa vị ngọt tự nhiên và hương thơm dịu."],
      ["bulb", "Gợi ý thưởng thức", "Dùng lạnh trong 30 phút đầu để cảm nhận rõ nhất các tầng hương."],
    ],
    scores: [["Độ đậm", 5], ["Độ béo ngọt", 6.5], ["Hương thơm", 8.5]],
  },
};

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    router = useRouter(),
    add = useCart((s) => s.add),
    cartBusy = useCart((s) => s.busy),
    cartError = useCart((s) => s.error),
    cartItems = useCart((s) => s.items);

  const [product, setProduct] = useState<Product | null>(null),
    [related, setRelated] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [size, setSize] = useState<ProductSize["code"]>("S"),
    [selected, setSelected] = useState<string[]>([]),
    [quantity, setQuantity] = useState(1),
    [ice, setIce] = useState(ICE[0]),
    [sugar, setSugar] = useState(SUGAR[0]),
    [note, setNote] = useState(""),
    [liked, setLiked] = useState(false),
    [quickAdded, setQuickAdded] = useState(""),
    [preview, setPreview] = useState<ProductPreviewResult | null>(null),
    [previewLoading, setPreviewLoading] = useState(false),
    [previewError, setPreviewError] = useState(""),
    [previewRetryCount, setPreviewRetryCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    services.products
      .get(id)
      .then((p) => {
        setProduct(p);
        setSize(p?.sizes.find((s) => s.isDefault)?.code || "S");
        setQuantity(1);
        setSelected([]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    services.products
      .list()
      .then((list) => setRelated(list.filter((p) => p.id !== id).slice(0, 4)))
      .catch(() => setRelated([]));
  }, [id]);

  // Preview selection dynamically with the backend preview endpoint
  useEffect(() => {
    if (!product) return;
    let active = true;
    setPreviewLoading(true);
    setPreviewError("");

    const candidate: CartItemInput = {
      productId: product.id,
      size,
      toppingIds: selected,
      quantity,
      ice,
      sugar,
      note: note.trim() || undefined,
    };

    services.products
      .previewSelection(candidate, cartItems)
      .then((res) => {
        if (!active) return;
        setPreview(res);
      })
      .catch((err) => {
        if (!active) return;
        setPreviewError(err instanceof Error ? err.message : "Không thể kiểm tra tồn khả dụng");
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product?.id, size, selected, quantity, ice, sugar, note, cartItems, previewRetryCount]);

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

  const stock = chosenSize?.stock;
  const stockKnown = typeof stock === "number" && Number.isInteger(stock) && stock >= 0;

  const effectiveMaxAvailable = preview ? preview.maxAvailable : (stockKnown ? Math.min(99, stock) : 0);
  const canAddOne = preview ? preview.canAddOne : (quantity < effectiveMaxAvailable);
  const isCurrentlyValid = preview ? preview.valid : (stockKnown && stock > 0 && quantity <= effectiveMaxAvailable);

  const blocked = !product || invalid || !stockKnown || cartBusy || previewLoading || !isCurrentlyValid;

  const selectSize = (next: ProductSize) => {
    setSize(next.code);
    if (next.stock !== undefined && next.stock > 0 && quantity > next.stock) {
      setQuantity(Math.min(99, next.stock));
    }
  };

  const refreshStock = async () => {
    try {
      const fresh = await services.products.get(id);
      setProduct(fresh);
      const selectedSize = fresh?.sizes.find((s) => s.code === size);
      if (selectedSize) selectSize(selectedSize);
      setPreviewRetryCount((c) => c + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải tồn khả dụng'); }
  };

  const story = stories[product?.category || ""] || stories.default;

  const submit = async (next: "/cart" | "/checkout") => {
    if (!product || blocked) return;
    const added = await add({
      key: itemKey(product.id, size, selected, ice, sugar, note),
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
      note: note.trim() || undefined,
      sizeOptions: product.sizes,
    });
    if (added) {
      router.push(next);
      return;
    }
    await refreshStock();
  };

  if (loading) return <Loading label="Đang tải món..." />;
  if (error || !product)
    return (
      <div className="container" style={{ padding: "40px 0" }}>
        <ErrorState
          message={error || "Không tìm thấy món"}
          retry={() => window.location.reload()}
        />
      </div>
    );

  return (
    <main className="pd-page">
      <div className="container">
        <nav aria-label="Breadcrumb" className="pd-breadcrumb">
          <Link href="/">Trang chủ</Link>
          <span>/</span>
          <Link href="/products">Thực đơn</Link>
          <span>/</span>
          <strong>{product.name}</strong>
        </nav>
        <div className="pd-layout">
          <div className="pd-media">
            <div className="pd-photo">
              <ProductImage
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label={liked ? "Bỏ yêu thích" : "Yêu thích"}
                aria-pressed={liked}
                className={`pd-fav ${liked ? "is-active" : ""}`}
                onClick={() => setLiked((v) => !v)}
              >
                <Icon name="heart" size={20} />
              </button>
            </div>
            <div className="pd-chips">
              {story.chips.map(([icon, label]) => (
                <span key={label} className="pd-chip">
                  <Icon name={icon} size={14} /> {label}
                </span>
              ))}
            </div>
          </div>
          <section className="pd-card" aria-labelledby="product-title">
            <span className="pd-tag">Cold Brew Special</span>
            <h1 id="product-title" className="pd-title">
              {product.name}
            </h1>
            <div className="pd-price-row">
              <span className="pd-price">{money(unit)}</span>
              <small className="pd-price-note">
                (Đã gồm topping & size tùy chọn)
              </small>
            </div>
            <p className="pd-desc">{product.description}</p>
            <div className="pd-group">
              <div className="pd-group-head">
                <h2>1. Chọn Kích Cỡ</h2>
                <span className="pd-volume">
                  Dung tích ~{VOLUME[size] || "350ml"}
                </span>
              </div>
              <div className="pd-sizes" role="radiogroup" aria-label="Chọn size">
                {product.sizes.map((s) => (
                  <button
                    key={s.code}
                    role="radio"
                    aria-checked={size === s.code}
                    aria-disabled={!s.available}
                    className={`pd-size ${size === s.code ? "selected" : ""} ${s.available ? "" : "is-disabled"}`}
                    onClick={() => selectSize(s)}
                  >
                    <span className="pd-size-tag">{s.code}</span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.available ? (s.stock !== undefined ? `Còn ${s.stock} ly` : "Sẵn sàng") : "Tạm hết"}
                    </small>
                    <span>
                      {s.extraPrice > 0
                        ? `+${money(s.extraPrice)}`
                        : money(product.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="pd-group">
              <div className="pd-group-head">
                <h2>2. Thêm Topping & Nâng cấp</h2>
              </div>
              <div className="pd-toppings">
                {product.toppings.map((t) => (
                  <label
                    key={t.id}
                    className={`pd-topping ${selected.includes(t.id) ? "selected" : ""} ${t.available ? "" : "is-disabled"}`}
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
                    />
                    <span>{t.name}</span>
                    <small>+{money(t.extraPrice)}</small>
                  </label>
                ))}
              </div>
            </div>
            <div className="pd-group">
              <div className="pd-group-head">
                <h2>3. Mức đá & độ ngọt</h2>
              </div>
              <div className="pd-segments" role="group" aria-label="Mức đá">
                {ICE.map((x) => (
                  <button
                    key={x}
                    aria-pressed={ice === x}
                    className={ice === x ? "selected" : ""}
                    onClick={() => setIce(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="pd-segments" role="group" aria-label="Mức đường">
                {SUGAR.map((x) => (
                  <button
                    key={x}
                    aria-pressed={sugar === x}
                    className={sugar === x ? "selected" : ""}
                    onClick={() => setSugar(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
            <label className="pd-note">
              <span>
                <Icon name="note" size={16} /> Ghi chú cho Barista
              </span>
              <input
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: ít đá, nhiều sữa đặc, mang đi..."
              />
            </label>
            <div className="pd-total">
              <div className="pd-qty">
                <span>Số lượng:</span>
                <Quantity
                  value={quantity}
                  onChange={setQuantity}
                  max={effectiveMaxAvailable}
                  disabled={cartBusy || previewLoading || !stockKnown || (preview ? !preview.valid && preview.maxAvailable === 0 : stock === 0)}
                  canAdd={canAddOne}
                />
              </div>
              <div className="pd-total-price">
                <small>Tổng thanh toán:</small>
                <strong>{money(unit * quantity)}</strong>
              </div>
            </div>
            <p className="muted">Sức bán size {size} hiện tại, chưa tính topping và giỏ hàng; chưa giữ hàng.</p>
            {!stockKnown && <p className="error">Không thể xác định tồn khả dụng. <button onClick={load}>Thử lại</button></p>}
            
            {preview && preview.valid && !preview.canAddOne && (
              <p role="status" className="pd-notice warning">
                {preview.reason === 'MAX_REACHED' ? (
                  "Đã đạt số lượng tối đa 99 phần cho một lần đặt."
                ) : (
                  <>
                    Không thể thêm ly size {size}:{" "}
                    {preview.nextShortages.map((s, idx) => (
                      <span key={s.ingredientId}>
                        {idx > 0 && "; "}
                        <strong>{s.name}</strong> không đủ cho ly tiếp theo (thiếu {s.shortage}{s.unit})
                      </span>
                    ))}
                    .
                  </>
                )}
              </p>
            )}

            {preview && !preview.valid && (
              <p role="alert" className="pd-notice error">
                {preview.currentShortages.length > 0 ? (
                  <>
                    {preview.maxAvailable === 0
                      ? `Size ${size} tạm hết hàng: `
                      : `Không đủ nguyên liệu cho ${quantity} ly size ${size}: `}
                    {preview.currentShortages.map((s, idx) => (
                      <span key={s.ingredientId}>
                        {idx > 0 && "; "}
                        <strong>{s.name}</strong> không đủ (cần {s.required}{s.unit}, kho còn {s.stock}{s.unit})
                      </span>
                    ))}
                    {preview.maxAvailable > 0 && `. Vui lòng giảm số lượng xuống tối đa ${preview.maxAvailable} ly.`}
                  </>
                ) : preview.reason === 'MAX_REACHED' ? (
                  "Đã vượt quá số lượng tối đa 99 phần cho một món."
                ) : preview.reason === 'UNAVAILABLE' ? (
                  `Size ${size} hiện tạm ngưng phục vụ.`
                ) : preview.reason === 'INVALID_RECIPE' ? (
                  "Món chưa có định mức nguyên vật liệu hợp lệ."
                ) : (
                  "Lựa chọn không hợp lệ."
                )}
              </p>
            )}

            {previewError && (
              <p role="alert" className="pd-notice error">
                {previewError}.{" "}
                <button
                  type="button"
                  onClick={() => setPreviewRetryCount((c) => c + 1)}
                  className="btn-link"
                  style={{ textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
                >
                  Thử lại
                </button>
              </p>
            )}

            {cartBusy && <p role="status">Đang kiểm tra nguyên liệu cho giỏ hàng...</p>}
            {cartError && <p role="alert" className="error">{cartError}</p>}
            {invalid && stock !== 0 && <p className="error">Tùy chọn không hợp lệ.</p>}
            
            <div className="pd-actions">
              <button
                className="pd-btn pd-btn-dark"
                disabled={blocked}
                onClick={() => submit("/cart")}
              >
                <Icon name="bag" size={18} />
                Thêm vào giỏ hàng
              </button>
              <button
                className="pd-btn pd-btn-caramel"
                disabled={blocked}
                onClick={() => submit("/checkout")}
              >
                <Icon name="bolt" size={18} />
                Mua ngay
              </button>
            </div>
            <div className="pd-assure">
              <span>
                <Icon name="clock" size={14} /> Pha chế trong khoảng 20 phút
              </span>
              <span>
                <Icon name="snow" size={14} /> Đá viên bảo quản riêng
              </span>
            </div>
          </section>
        </div>
      </div>
      <section className="pd-details">
        <div className="container">
          <span className="pd-eyebrow">Artisanal details</span>
          <h2 className="pd-section-title">Mô tả sản phẩm & Nguồn gốc</h2>
          <p className="pd-section-lead">{product.description}</p>
          <div className="pd-info-grid">
            {story.cards.map(([icon, title, text], i) => (
              <article key={title} className="pd-info">
                <span className={`pd-info-icon tone-${i}`}>
                  <Icon name={icon} size={18} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="pd-scores">
            {story.scores.map(([label, score]) => (
              <div key={label} className="pd-score">
                <span className="pd-score-label">{label}</span>
                <div className="pd-score-bar">
                  <span style={{ width: `${(score / 10) * 100}%` }} />
                </div>
                <strong className="pd-score-val">{score}/10</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <section className="pd-related">
          <div className="container">
            <h2 className="pd-section-title">Gợi ý cùng gu cho bạn</h2>
            <div className="pd-related-grid">
              {related.map((item) => (
                <article key={item.id} className="pd-related-card">
                  <div className="pd-related-thumb">
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="pd-related-body">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <div className="pd-related-bottom">
                      <strong>{money(item.price)}</strong>
                      <div className="pd-related-actions">
                        <Link
                          href={`/products/${item.id}`}
                          className="btn btn-sm btn-secondary"
                        >
                          Tùy chỉnh
                        </Link>
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={cartBusy || quickAdded === item.id || item.stock === 0}
                          onClick={async () => {
                            setQuickAdded(item.id);
                            await add({
                              key: itemKey(item.id, "S", [], ICE[0], SUGAR[0]),
                              productId: item.id,
                              name: item.name,
                              imageUrl: item.imageUrl,
                              size: "S",
                              toppingIds: [],
                              toppingNames: [],
                              unitPrice: item.price,
                              quantity: 1,
                              ice: ICE[0],
                              sugar: SUGAR[0],
                            });
                            setQuickAdded("");
                          }}
                        >
                          {item.stock === 0 ? "Hết" : quickAdded === item.id ? "Đang thêm..." : "+ Thêm"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
