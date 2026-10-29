"use client";
import type { OrderStatus } from "@/types/domain";
export function Loading({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div role="status" className="panel card" style={{ textAlign: "center" }}>
      <div className="spinner" />
      {label}
    </div>
  );
}
export function Empty({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel card" style={{ textAlign: "center", padding: 42 }}>
      <h2>Chưa có nội dung</h2>
      <p className="muted">{message}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="panel card">
      <p className="error">{message}</p>
      {retry && (
        <button className="btn btn-secondary" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}
export function Quantity({
  value,
  onChange,
  max = 99,
  disabled = false,
  canAdd = true,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  disabled?: boolean;
  canAdd?: boolean;
}) {
  const atMax = value >= Math.min(99, max) || !canAdd;
  return (
    <div className="quantity">
      <button
        aria-label="Giảm số lượng"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span>{value}</span>
      <button
        aria-label="Tăng số lượng"
        disabled={disabled || atMax}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
const labels: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  PREPARING: "Đang pha chế",
  READY: "Sẵn sàng nhận",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};
export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status ${status}`}>{labels[status]}</span>;
}
export function Timeline({ status }: { status: OrderStatus }) {
  if (status === "PAYMENT_FAILED" || status === "CANCELLED")
    return <StatusBadge status={status} />;
  const states: OrderStatus[] = [
    "PENDING",
    "PAID",
    "PREPARING",
    "READY",
    "COMPLETED",
  ];
  return (
    <div className="timeline">
      {states.map((s, i) => (
        <span key={s} className={i <= states.indexOf(status) ? "done" : ""}>
          {labels[s]}
        </span>
      ))}
    </div>
  );
}
export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const fallback = /matcha/i.test(alt)
    ? "/images/products/sample-matcha.svg"
    : /trà|đào/i.test(alt)
      ? "/images/products/sample-iced-tea.svg"
      : /cappuccino|americano|macchiato/i.test(alt)
        ? "/images/products/sample-latte.svg"
        : "/images/products/sample-milk-coffee.svg";
  return (
    // Original Stitch photos are remote; keep a local fallback for offline demos.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt={alt}
      onError={(e) => {
        if (e.currentTarget.src.endsWith(fallback)) {
          e.currentTarget.style.visibility = "hidden";
          e.currentTarget.parentElement?.classList.add("image-fallback");
        } else e.currentTarget.src = fallback;
      }}
    />
  );
}
