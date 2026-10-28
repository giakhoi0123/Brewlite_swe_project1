# ADR-001: Monorepo và Cấu trúc Mã nguồn Frontend/Backend

- **Trạng thái:** ACCEPTED
- **Ngày quyết định:** 2026-10-24
- **Người đề xuất:** Phạm Gia Khôi / Nhóm BrewLite
- **Thành viên review:** Toàn nhóm (6 thành viên)

## 1. Bối cảnh (Context)
Dự án BrewLite bao gồm 2 phân hệ phần mềm chính:
1. Ứng dụng giao diện người dùng (Frontend): Dành cho Khách hàng đặt món và Nhân viên Barista nhận đơn, yêu cầu tính năng mobile-first/PWA, SSR và responsive cao.
2. Ứng dụng máy chủ nghiệp vụ (Backend REST API): Cung cấp các dịch vụ xác thực, danh mục món, tính giá giỏ hàng, đặt đơn, xử lý giao dịch thanh toán và phân quyền KDS.

Nhóm gồm 6 thành viên làm việc song song theo chu trình tuần tự của môn học. Cần một cấu trúc lưu trữ mã nguồn cho phép quản lý phiên bản đồng nhất, chia sẻ TypeScript interfaces/DTOs, thống nhất pipeline CI/CD và đơn giản hóa môi trường kiểm thử cục bộ.

## 2. Các phương án xem xét (Options Considered)
1. **Phương án A - Polyrepo (Tách 2 repository riêng biệt: `brewlite-fe` và `brewlite-be`):**
   - *Ưu điểm:* Quyền kiểm soát commit độc lập, kích thước repo nhỏ.
   - *Nhược điểm:* Khó đồng bộ API contracts; việc theo dõi tiến độ hai Sprint và đối chiếu tài liệu `docs/` trở nên phân mảnh; cấu hình CI/CD và Docker Compose phải nhân đôi; không phù hợp yêu cầu nộp 1 repo duy nhất của môn học.
2. **Phương án B - Monorepo (Tập trung toàn bộ Frontend, Backend, Docs, Docker vào một repository duy nhất `brewlite/`):**
   - *Ưu điểm:* Một nguồn chân lý duy nhất (Single Source of Truth); dễ dàng chia sẻ Type contract; hợp nhất `docker-compose.yml` để chạy 1 lệnh là lên toàn bộ hệ thống; kiểm soát lịch sử commit/PR và ma trận truy vết tập trung.
   - *Nhược điểm:* Cần tổ chức thư mục gọn gàng để tránh xung đột mã giữa các thành viên.

## 3. Quyết định (Decision)
Chọn **Phương án B - Monorepo**.
Cấu trúc tổ chức thư mục:
- `frontend/` (tương ứng `apps/web` trong đề): Khởi tạo bằng Next.js (App Router, Tailwind CSS, Zustand, TypeScript).
- `backend/` (tương ứng `apps/api` trong đề): Khởi tạo bằng NestJS (Modular Architecture, class-validator, Prisma Client).
- `docs/`: Chứa toàn bộ tài liệu kiến trúc (ADR), yêu cầu (SRS, Use-case), sơ đồ PlantUML và ma trận truy vết.
- `docker-compose.yml` tại thư mục gốc để quản lý đồng bộ cả 3 dịch vụ: `web` (3000), `api` (3001), `postgres` (5434 host / 5432 nội bộ).

## 4. Đánh đổi & Hệ quả (Trade-offs & Consequences)
- **Tích cực:** Quản lý mã nguồn và tài liệu đồng nhất; CI có thể kiểm tra cả Frontend và Backend trong cùng một Pull Request; việc nghiệm thu tuần tự 5 Task của Assignment 2 được minh chứng rõ ràng trên một Git log duy nhất.
- **Tiêu cực:** Các thành viên phải tuân thủ nghiêm ngặt nhánh làm việc (`feature/*`) và không sửa đè file cấu hình chung của nhau.

