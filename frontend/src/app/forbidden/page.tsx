import Link from "next/link";
export default function Forbidden() {
  return (
    <main className="container main">
      <h1>Bạn không có quyền truy cập trạm Barista</h1>
      <Link className="btn btn-primary" href="/">
        Về trang chủ
      </Link>
    </main>
  );
}
