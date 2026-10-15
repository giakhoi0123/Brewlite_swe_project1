"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/services";
import { useCart } from "@/stores/cart";
import type { CartItem, Product, ProductSize } from "@/types/domain";
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
// Nội dung giới thiệu tĩnh theo nhóm món (không phải dữ liệu đánh giá thật).
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
    add = useCart((s) => s.add);
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
    [quickAdded, setQuickAdded] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    setError("");
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
  useEffect(() => {
    services.products
      .list()
      .then((list) => setRelated(list.filter((p) => p.id !== id).slice(0, 4)))
      .catch(() => setRelated([]));
  }, [id]);
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
  const blocked = !product || invalid || product.stock < quantity;
  const story = stories[product?.category || ""] || stories.default;
  const submit = (next: "/cart" | "/checkout") => {
    if (!product || blocked) return;
    add({
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
    });
    router.push(next);
  };
  const quickAdd = (p: Product) => {
    const s = p.sizes.find((x) => x.isDefault) || p.sizes[0];
    if (!s || p.stock < 1) return;
    const item: CartItem = {
      key: itemKey(p.id, s.code, [], ICE[0], SUGAR[0]),
      productId: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      size: s.code,
      toppingIds: [],
      toppingNames: [],
      unitPrice: p.price + s.extraPrice,
      quantity: 1,
      ice: ICE[0],
      sugar: SUGAR[0],
    };
    add(item);
    setQuickAdded(p.id);
  };
  if (loading)
    return (
      <main className="container main">
        <Loading />
      </main>
    );
  if (error)
    return (
      <main className="container main">
        <ErrorState message={error} retry={load} />
      </main>
    );
  if (!product)
    return (
      <main className="container main">
        <ErrorState message="Không tìm thấy sản phẩm" />
      </main>
    );
  return (
    <main className="pd-page">
      <div className="container">
        <nav className="pd-breadcrumb" aria-label="Breadcrumb">
          <Icon name="home" size={14} />
          <Link href="/">Trang chủ</Link>
          <span>/</span>
          <Link href="/#menu">{product.category}</Link>
          <span>/</span>
          <strong>{product.name}</strong>
        </nav>
        <div className="pd-layout">
          <div className="pd-media">
            <div className="pd-photo">
              <ProductImage src={product.imageUrl} alt={product.name} />
              <div className="pd-photo-tags">
                <span className="pd-tag-dark">{product.category}</span>
                <span className="pd-tag-light">
                  {product.stock > 0 ? `Còn ${product.stock} phần` : "Tạm hết"}
                </span>
              </div>
              <button
                className={`pd-like ${liked ? "is-liked" : ""}`}
                aria-label="Yêu thích"
                aria-pressed={liked}
                onClick={() => setLiked((v) => !v)}
              >
                <Icon name="heart" size={20} />
              </button>
            </div>
            <div className="pd-chips">
              {story.chips.map(([icon, label]) => (
                <span key={label}>
                  <Icon name={icon} size={14} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <section className="pd-card">
            <div className="pd-card-top">
              <span className="pd-eyebrow">BrewLite Signature</span>
              <span className="pd-fresh">Pha chế khi đặt</span>
            </div>
            <h1 className="pd-title">{product.name}</h1>
            <div className="pd-price-row">
              <span className="pd-price">{money(product.price)}</span>
              <span className="pd-price-note">Giá size S, chưa gồm topping</span>
            </div>
            <p className="pd-description">{product.description}</p>
            <div className="pd-group">
              <div className="pd-group-head">
                <h2>
                  1. Chọn kích thước <small>(Bắt buộc)</small>
                </h2>
                <span>
                  Size {size} ({VOLUME[size]})
                </span>
              </div>
              <div className="pd-sizes">
                {product.sizes.map((s) => (
                  <button
                    key={s.code}
                    disabled={!s.available}
                    aria-pressed={size === s.code}
                    className={`pd-size ${size === s.code ? "selected" : ""}`}
                    onClick={() => setSize(s.code)}
                  >
                    {s.code === "M" && <em>Khuyến dùng</em>}
                    <Icon name="cup" size={s.code === "S" ? 16 : s.code === "M" ? 19 : 22} />
                    <strong>Size {s.code}</strong>
                    <small>
                      {s.name} · {VOLUME[s.code]}
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
                <Quantity value={quantity} onChange={setQuantity} />
              </div>
              <div className="pd-total-price">
                <small>Tổng thanh toán:</small>
                <strong>{money(unit * quantity)}</strong>
              </div>
            </div>
            {product.stock === 0 && (
              <p className="error">Món này đang hết hàng.</p>
            )}
            {product.stock > 0 && quantity > product.stock && (
              <p className="error">Chỉ còn {product.stock} phần.</p>
            )}
            {invalid && <p className="error">Tùy chọn không hợp lệ.</p>}
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
            <div>
              <span className="pd-scores-eyebrow">Cân bằng hương vị</span>
              <h3>Chỉ số hương vị Barista</h3>
              <p>Thước đo độ đậm và các tầng hương vị đặc trưng của dòng {product.category}.</p>
            </div>
            {story.scores.map(([label, score], i) => (
              <div key={label} className="pd-score">
                <div>
                  <span>{label}</span>
                  <span>{score} / 10</span>
                </div>
                <div className="pd-bar">
                  <span className={`tone-${i}`} style={{ width: `${score * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <section className="container pd-related">
          <div className="pd-related-head">
            <div>
              <span className="pd-eyebrow">Thực đơn chọn lọc</span>
              <h2 className="pd-section-title">Có thể bạn sẽ thích</h2>
            </div>
            <Link href="/#menu">
              Xem tất cả <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          <div className="pd-related-grid">
            {related.map((p) => (
              <article key={p.id} className="pd-related-card">
                <Link href={`/products/${p.id}`} className="pd-related-photo">
                  <ProductImage src={p.imageUrl} alt={p.name} />
                  <span>{p.category}</span>
                </Link>
                <div className="pd-related-body">
                  <Link href={`/products/${p.id}`}>
                    <h3>{p.name}</h3>
                  </Link>
                  <p>{p.description}</p>
                  <div className="pd-related-bottom">
                    <strong>{money(p.price)}</strong>
                    <button
                      disabled={p.stock < 1}
                      aria-label={`Thêm nhanh ${p.name}`}
                      onClick={() => quickAdd(p)}
                    >
                      {p.stock < 1 ? (
                        "Tạm hết"
                      ) : quickAdded === p.id ? (
                        "Đã thêm"
                      ) : (
                        <>
                          <Icon name="plus" size={14} /> Thêm nhanh
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
