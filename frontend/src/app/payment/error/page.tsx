import Link from "next/link";

export default async function PaymentErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const retryHref = orderId
    ? `/checkout?resumeOrder=${encodeURIComponent(orderId)}`
    : null;

  return (
    <main className="container main payment-main">
      <section className="card payment-state-card" role="alert">
        <div className="payment-result-icon is-failure" aria-hidden="true">
          !
        </div>
        <p className="payment-eyebrow">Không thể mở cổng thanh toán</p>
        <h1>VNPAY chưa sẵn sàng</h1>
        <p className="payment-lead">
          BrewLite chưa thể tạo liên kết thanh toán an toàn. Giao dịch chưa được
          xác nhận và giỏ hàng của bạn vẫn được giữ nguyên.
        </p>
        <div className="payment-actions">
          {retryHref && (
            <Link className="btn btn-primary" href={retryHref}>
              Thử lại
            </Link>
          )}
          <Link className="btn btn-secondary" href="/orders">
            Kiểm tra đơn hàng
          </Link>
          <Link className="btn btn-outline" href="/cart">
            Về giỏ hàng
          </Link>
        </div>
      </section>
    </main>
  );
}
