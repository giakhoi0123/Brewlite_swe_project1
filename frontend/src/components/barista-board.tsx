"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { dataMode, services } from "@/services";
import type { Order, OrderStatus } from "@/types/domain";
import { money } from "@/types/domain";
import { ErrorState, Loading, StatusBadge } from "@/components/ui";
import "./barista-board.css";

export type BaristaView = "dashboard" | "orders" | "preparing" | "ready" | "history";
type Action = { order: Order; next: OrderStatus };

const navigation: { view: BaristaView; label: string; icon: string }[] = [
  { view: "dashboard", label: "Tổng quan", icon: "▦" },
  { view: "orders", label: "Đơn chờ pha", icon: "◷" },
  { view: "preparing", label: "Đang pha chế", icon: "☕" },
  { view: "ready", label: "Chờ giao", icon: "✓" },
  { view: "history", label: "Lịch sử xử lý", icon: "↺" },
];
const columns: { status: OrderStatus; label: string; next: OrderStatus; action: string }[] = [
  { status: "PAID", label: "Chờ pha chế", next: "PREPARING", action: "Bắt đầu pha chế" },
  { status: "PREPARING", label: "Đang pha chế", next: "READY", action: "Đã pha chế xong" },
  { status: "READY", label: "Sẵn sàng giao", next: "COMPLETED", action: "Xác nhận đã giao" },
];
const viewStatus: Partial<Record<BaristaView, OrderStatus>> = {
  orders: "PAID",
  preparing: "PREPARING",
  ready: "READY",
};
const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  PREPARING: "Đang pha chế",
  READY: "Sẵn sàng giao",
  COMPLETED: "Đã giao khách",
  CANCELLED: "Đã hủy",
};
const minutesWaiting = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
const canCancel = (status: OrderStatus) =>
  ["PENDING", "PAID", "PAYMENT_FAILED"].includes(status);

export function BaristaBoard({ view }: { view: BaristaView }) {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Order | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await services.barista.list();
      setOrders(rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được đơn hàng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || signingOut) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(`/barista/${view}`)}`);
    else if (user.role !== "BARISTA") router.replace("/forbidden");
    else void load();
  }, [authLoading, signingOut, user, view, router, load]);

  const openAction = (order: Order, next: OrderStatus) => {
    if (inFlight.current) return;
    setReason("");
    setAction({ order, next });
  };
  const submitAction = async () => {
    if (!action || inFlight.current) return;
    if (action.next === "CANCELLED" && !reason.trim()) {
      setError("Vui lòng nhập lý do hủy đơn");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const updated = action.next === "CANCELLED"
        ? await services.barista.cancel(action.order.id, reason.trim())
        : await services.barista.transition(action.order.id, action.next);
      setDetail((current) => current?.id === updated.id ? updated : current);
      setAction(null);
      setNotice(`Đơn #${updated.id}: ${statusLabel[updated.status]}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật đơn");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (authLoading || !user || user.role !== "BARISTA")
    return <main className="barista-gate"><Loading label="Đang kiểm tra quyền Barista..." /></main>;

  const counts = {
    PAID: orders.filter((order) => order.status === "PAID").length,
    PREPARING: orders.filter((order) => order.status === "PREPARING").length,
    READY: orders.filter((order) => order.status === "READY").length,
    COMPLETED: orders.filter((order) =>
      order.status === "COMPLETED" &&
      order.completedAt &&
      new Date(order.completedAt).toDateString() === new Date().toDateString(),
    ).length,
  };
  const visibleColumns = view === "dashboard"
    ? columns
    : columns.filter((column) => column.status === viewStatus[view]);
  const history = orders.filter((order) =>
    ["COMPLETED", "CANCELLED"].includes(order.status) &&
    `${order.id} ${order.customerName ?? ""} ${order.items.map((item) => item.name).join(" ")}`
      .toLocaleLowerCase("vi-VN").includes(search.toLocaleLowerCase("vi-VN")),
  ).reverse();

  const ticket = (order: Order, next?: OrderStatus, label?: string) => (
    <article className={`barista-ticket barista-ticket-${order.status.toLowerCase()}`} key={order.id}>
      <div className="barista-ticket-top">
        <strong>#{order.id}</strong>
        <StatusBadge status={order.status} />
      </div>
      <p className="barista-meta">
        {order.customerName || `Khách #${order.userId.slice(0, 8)}`} · {new Date(order.createdAt).toLocaleString("vi-VN")}
      </p>
      {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
        <p className="barista-wait">◷ Chờ {minutesWaiting(order.createdAt)} phút</p>
      )}
      <div className="barista-recipes">
        {order.items.map((item) => (
          <div className="barista-recipe" key={item.key}>
            <div><strong>{item.quantity}× {item.name}</strong><span>Size {item.size}</span></div>
            <small>{[item.ice, item.sugar, ...item.toppingNames].filter(Boolean).join(" · ")}</small>
            {item.note && <p className="barista-note">Ghi chú: {item.note}</p>}
          </div>
        ))}
      </div>
      {order.cancelReason && <p className="barista-note">Lý do hủy: {order.cancelReason}</p>}
      <div className="barista-ticket-total"><span>Tổng đơn</span><strong>{money(order.total)}</strong></div>
      <div className="barista-ticket-actions">
        {next && <button className="btn btn-primary" disabled={busy} onClick={() => openAction(order, next)}>{label}</button>}
        <button className="btn btn-outline" onClick={() => setDetail(order)}>Chi tiết</button>
        {dataMode !== "api" && canCancel(order.status) && <button className="btn btn-danger" disabled={busy} onClick={() => openAction(order, "CANCELLED")}>Báo sự cố</button>}
      </div>
    </article>
  );

  return (
    <div className="barista-workspace">
      <header className="barista-header">
        <Link href="/barista/dashboard" className="barista-brand">☕ <span>BrewLite KDS</span></Link>
        <span className="barista-label">Trạm Barista</span>
        <div className="barista-identity"><strong>{user.name}</strong><small>Nhân viên pha chế</small></div>
      </header>
      <aside className="barista-sidebar" aria-label="Điều hành pha chế">
        <div className="barista-sidebar-title">Điều hành pha chế</div>
        <nav>{navigation.map((item) => (
          <Link key={item.view} href={`/barista/${item.view}`} aria-current={view === item.view ? "page" : undefined}>
            <span aria-hidden="true">{item.icon}</span>{item.label}
          </Link>
        ))}</nav>
        <button className="barista-signout" disabled={signingOut} onClick={async () => {
          setSigningOut(true);
          try { await logout(); router.replace("/login"); }
          catch (cause) { setSigningOut(false); setError(cause instanceof Error ? cause.message : "Không thể đăng xuất"); }
        }}>Đăng xuất ca trực</button>
      </aside>
      <main className="barista-content">
        <section className="barista-ribbon">
          <div><span className="eyebrow">BrewLite · Trạm pha chế</span><h1>Trạm Barista KDS</h1><p>Đơn hàng và tiến độ pha chế được cập nhật từ cùng nguồn dữ liệu.</p></div>
          <div className="barista-ribbon-actions"><span className="barista-online">● {dataMode === "api" ? "API trực tuyến" : "Chế độ demo"}</span><button className="btn btn-outline" onClick={() => void load()} disabled={loading}>↻ Làm mới</button></div>
        </section>
        {notice && <div className="barista-toast" role="status">✓ {notice}<button aria-label="Đóng thông báo" onClick={() => setNotice("")}>×</button></div>}
        {error && !action && <ErrorState message={error} retry={() => void load()} />}
        <section className="barista-kpis" aria-label="Tổng quan đơn hàng">
          <div><small>Đơn mới chờ pha</small><strong>{counts.PAID}</strong></div>
          <div><small>Đang pha chế</small><strong>{counts.PREPARING}</strong></div>
          <div><small>Chờ giao tại quầy</small><strong>{counts.READY}</strong></div>
          <div><small>Đã giao hôm nay</small><strong>{dataMode === "api" ? "—" : counts.COMPLETED}</strong></div>
        </section>
        {loading ? <Loading label="Đang tải đơn hàng..." /> : view === "history" ? (
          <section className="barista-history">
            <div className="barista-section-heading"><div><span className="eyebrow">Lịch sử xử lý</span><h2>Đơn đã hoàn tất và đã hủy</h2></div><label>Tìm đơn<input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mã đơn, khách, món..." /></label></div>
            {dataMode === "api" ? <div className="barista-empty">Lịch sử xử lý đang chờ API Staff Orders của TV4.</div> : history.length ? <div className="barista-history-grid">{history.map((order) => ticket(order))}</div> : <div className="barista-empty">Không có đơn phù hợp trong lịch sử.</div>}
          </section>
        ) : (
          <section className={`barista-board ${view !== "dashboard" ? "barista-board-focused" : ""}`} aria-label="Hàng đợi pha chế">
            {visibleColumns.map((column, index) => {
              const queue = orders.filter((order) => order.status === column.status);
              return <div className="barista-column" key={column.status}>
                <div className="barista-column-heading"><h2><span className={`barista-dot barista-dot-${column.status.toLowerCase()}`} />{view === "dashboard" ? `${index + 1}. ` : ""}{column.label}</h2><span>{queue.length} đơn</span></div>
                {queue.length ? queue.map((order) => ticket(order, column.next, column.action)) : <div className="barista-empty">Chưa có đơn {column.label.toLocaleLowerCase("vi-VN")}.</div>}
              </div>;
            })}
          </section>
        )}
        <p className="barista-demo-note">{dataMode === "api" ? "Staff API hiện hỗ trợ hàng đợi và chuyển trạng thái; hủy có lý do, lịch sử và KPI hoàn tất còn chờ TV4." : "Đơn demo được chia sẻ với trang Đơn hàng của tôi trên cùng trình duyệt."}</p>
      </main>
      {detail && <div className="barista-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
        <section className="barista-modal" role="dialog" aria-modal="true" aria-label={`Chi tiết đơn ${detail.id}`}>
          <div className="row"><span className="eyebrow">Chi tiết đơn hàng</span><button className="barista-close" onClick={() => setDetail(null)} aria-label="Đóng chi tiết">×</button></div>
          <h2>#{detail.id}</h2><StatusBadge status={detail.status} />
          <p>{detail.customerName || `Khách #${detail.userId.slice(0, 8)}`} · {new Date(detail.createdAt).toLocaleString("vi-VN")}</p>
          {detail.items.map((item) => <div className="barista-recipe" key={item.key}><strong>{item.quantity}× {item.name} · Size {item.size}</strong><small>{[item.ice, item.sugar, ...item.toppingNames].filter(Boolean).join(" · ")}</small>{item.note && <p className="barista-note">Ghi chú: {item.note}</p>}</div>)}
          {detail.cancelReason && <p className="barista-note">Lý do hủy: {detail.cancelReason}</p>}
          <div className="barista-ticket-total"><span>Tổng đơn</span><strong>{money(detail.total)}</strong></div>
          <p className="barista-meta">Tiến trình: {statusLabel[detail.status]}</p>
          <div className="barista-ticket-actions">{columns.filter((column) => column.status === detail.status).map((column) => <button className="btn btn-primary" key={column.status} onClick={() => openAction(detail, column.next)}>{column.action}</button>)}{dataMode !== "api" && canCancel(detail.status) && <button className="btn btn-danger" onClick={() => openAction(detail, "CANCELLED")}>Hủy đơn sự cố</button>}</div>
        </section>
      </div>}
      {action && <div className="barista-overlay" role="presentation">
        <section className="barista-modal" role="dialog" aria-modal="true" aria-label="Xác nhận cập nhật đơn">
          <span className="eyebrow">Xác nhận thao tác</span>
          <h2>{action.next === "CANCELLED" ? "Hủy đơn hàng sự cố" : statusLabel[action.next]}</h2>
          <p>Đơn #{action.order.id} · {money(action.order.total)}</p>
          {action.next === "CANCELLED" && <label className="barista-reason">Lý do hủy đơn<textarea className="field" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="Ví dụ: Hết nguyên liệu..." required /></label>}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="barista-ticket-actions"><button className="btn btn-secondary" disabled={busy} onClick={() => { setAction(null); setError(""); }}>Quay lại</button><button className={action.next === "CANCELLED" ? "btn btn-danger" : "btn btn-primary"} disabled={busy || (action.next === "CANCELLED" && !reason.trim())} onClick={() => void submitAction()}>{busy ? "Đang cập nhật..." : "Xác nhận"}</button></div>
        </section>
      </div>}
    </div>
  );
}
