"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ErrorState, Loading } from "@/components/ui";
import { services } from "@/services";
import { money } from "@/types/domain";
import type { AdminPayment } from "@/types/domain";

type Filter = "ALL" | AdminPayment["status"];

const filterLabels: Record<Filter, string> = {
  ALL: "Tất cả",
  PROCESSING: "Đang chờ",
  PAID: "Thành công",
  PAYMENT_FAILED: "Thất bại",
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<Filter>("PROCESSING");
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const latestLoadId = useRef(0);

  const load = useCallback(async (background = false) => {
    const loadId = ++latestLoadId.current;
    if (!background) setLoading(true);
    if (!background) setError("");
    try {
      const nextRows = await services.adminPayments.list(
        filter === "ALL" ? undefined : filter,
      );
      if (loadId !== latestLoadId.current) return;
      setRows(nextRows);
      setError("");
    } catch (cause) {
      if (loadId !== latestLoadId.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tải được yêu cầu thanh toán",
      );
    } finally {
      if (loadId === latestLoadId.current && !background) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/admin/payments");
    else if (user?.role && user.role !== "ADMIN") router.replace("/forbidden");
    else if (user?.role === "ADMIN") void load();
  }, [authLoading, user, router, load]);

  useEffect(() => {
    if (user?.role !== "ADMIN" || filter !== "PROCESSING") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await load(true);
      if (active) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [user?.role, filter, load]);

  const review = async (
    row: AdminPayment,
    decision: "APPROVE" | "REJECT",
  ) => {
    const note = notes[row.id]?.trim();
    if (decision === "REJECT" && !note) {
      setError("Vui lòng nhập lý do trước khi đánh dấu Thất bại.");
      return;
    }
    if (
      !window.confirm(
        decision === "APPROVE"
          ? `Xác nhận yêu cầu ${row.orderId} thành công?`
          : `Xác nhận yêu cầu ${row.orderId} thất bại?`,
      )
    )
      return;

    setBusyId(row.id);
    setError("");
    try {
      await services.adminPayments.review(row.id, decision, note);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không xử lý được yêu cầu",
      );
    } finally {
      setBusyId("");
    }
  };

  if (authLoading || (loading && !rows.length))
    return (
      <main className="container main">
        <Loading label="Đang tải yêu cầu thanh toán..." />
      </main>
    );

  if (!user || user.role !== "ADMIN")
    return (
      <main className="container main">
        <Loading label="Đang kiểm tra quyền truy cập..." />
      </main>
    );

  return (
    <main className="container main admin-payment-main">
      <div className="admin-payment-heading">
        <div>
          <span className="eyebrow">BrewLite Admin</span>
          <h1 className="section-title">Quản lý yêu cầu thanh toán</h1>
          <p className="muted">
            Chỉ các yêu cầu “Thanh toán qua Admin” xuất hiện tại đây.
          </p>
        </div>
        <button className="btn btn-outline" disabled={loading} onClick={() => void load()}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      <div className="admin-payment-filters" aria-label="Lọc trạng thái">
        {(Object.keys(filterLabels) as Filter[]).map((value) => (
          <button
            key={value}
            className={`pill ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {filterLabels[value]}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} retry={() => void load()} />}

      {!rows.length && !error ? (
        <section className="card panel admin-payment-empty">
          <h2>Không có yêu cầu phù hợp</h2>
          <p className="muted">Danh sách sẽ tự cập nhật khi khách gửi yêu cầu mới.</p>
        </section>
      ) : (
        <div className="admin-payment-list">
          {rows.map((row) => (
            <article className="card admin-payment-card" key={row.id}>
              <div className="admin-payment-card-head">
                <div>
                  <span className="eyebrow">Đơn #{row.orderId}</span>
                  <h2>{row.customer.name}</h2>
                  <p className="muted">{row.customer.email}</p>
                </div>
                <div className="admin-payment-amount">
                  <strong>{money(row.amount)}</strong>
                  <span className={`status ${row.status}`}>
                    {filterLabels[row.status]}
                  </span>
                </div>
              </div>

              <dl className="admin-payment-meta">
                <div>
                  <dt>Gửi lúc</dt>
                  <dd>{new Date(row.createdAt).toLocaleString("vi-VN")}</dd>
                </div>
                <div>
                  <dt>Trạng thái đơn</dt>
                  <dd>{row.orderStatus}</dd>
                </div>
                {row.reviewedBy && (
                  <div>
                    <dt>Người xử lý</dt>
                    <dd>{row.reviewedBy.name}</dd>
                  </div>
                )}
              </dl>

              {row.status === "PROCESSING" ? (
                <div className="admin-payment-review">
                  <label>
                    Ghi chú / lý do thất bại
                    <textarea
                      className="field"
                      rows={2}
                      maxLength={500}
                      value={notes[row.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))
                      }
                      placeholder="Bắt buộc khi chọn Thất bại"
                    />
                  </label>
                  <div className="admin-payment-actions">
                    <button
                      className="btn btn-primary"
                      disabled={busyId === row.id}
                      onClick={() => review(row, "APPROVE")}
                    >
                      Thành công
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={busyId === row.id}
                      onClick={() => review(row, "REJECT")}
                    >
                      Thất bại
                    </button>
                  </div>
                </div>
              ) : (
                row.reviewNote && <p className="notice">Ghi chú: {row.reviewNote}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
