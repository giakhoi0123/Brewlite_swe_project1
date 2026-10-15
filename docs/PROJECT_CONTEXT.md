# Ngữ cảnh dự án cho phiên làm việc tiếp theo

## Cập nhật TV1 ngày 2026-10-16 (đọc trước các ghi chú lịch sử bên dưới)

Làm việc trên **nhánh hiện có** `feature/auth-and-base`. Không tạo nhánh mới. Nguồn thiết kế vẫn là toàn bộ 9 export `stitch/`; trang hồ sơ và Barista KDS đã được chỉnh theo ảnh, với 5 route Barista. `frontend/src/components/barista-board.tsx` là UI chính, `barista-board.css` là CSS; `frontend/src/app/barista/[view]/page.tsx` dùng cho orders/preparing/ready/history. Customer shell được ẩn trên staff route.

Auth thật có thêm `users.session_version` và migration `20261016000000_session_version`; đăng xuất tăng version để token cũ trả 401, kể cả bản sao cookie. Đây là invalidation ở cấp tài khoản (mọi thiết bị). `/auth/me` vẫn là nguồn khôi phục phiên; response auth có `Cache-Control: no-store`. Cần `prisma migrate deploy` trên DB nhóm trước khi chạy backend build mới. Test trên DB QA `brewlite_auth_test` đã migrate/seed và chạy HTTP smoke; không sửa dữ liệu DB phát triển.

Mock Barista/Customer dùng chung key localStorage `brewlite-demo-orders-v1`; các transition có kiểm tra trạng thái, hủy cần lý do. API adapter dùng `/staff/orders`, `/staff/orders/:id`, `PATCH /status`, `PATCH /cancel` và không fallback khi API mode lỗi. TV4 chưa triển khai các endpoint này. `completedAt` cần được TV4 trả cho KPI giao trong ngày. PENDING/PAID/PAYMENT_FAILED được hủy; PREPARING chưa hỗ trợ hủy.

Bằng chứng mới nhất: backend Jest 59/59, frontend unit 8/8, demo Playwright 4/4, build/lint frontend PASS, PostgreSQL HTTP smoke PASS; QA browser 1440/768/390 các route chính không tràn sau khi sửa header. Các ghi chú test count cũ bên dưới là lịch sử. `NEXT_PUBLIC_DATA_MODE` có **mock/hybrid/api**; Auth luôn là API thật.

BrewLite 1.0 là bài tập nhóm 6 người, yêu cầu 10 Task trong `docs/IMPLEMENTATION_PLAN.md`. **Chỉ sửa repo `BrewLite_swe-project_1`**. Repo này ban đầu chỉ có 9 export Stitch; đã thêm Next.js frontend và NestJS backend (backend auth/products được lấy làm nền từ dự án BrewLite bên cạnh, sau đó sửa trong repo này). Không sửa `BrewLite_swe_project_2`.

Nguồn giao diện: `stitch/*/code.html`, ảnh tham chiếu `screen.webp` đã nén từ PNG, và `stitch/artisanal_vietnamese_coffee_ordering/DESIGN.md`. Frontend `frontend/src/app`; state giỏ Zustand `frontend/src/stores/cart.ts`; domain model `frontend/src/types/domain.ts`; service interface/adapters `frontend/src/services`. Auth là API thật; Payment có backend core/schema nhưng chờ Orders port để bật endpoint; Orders/Promotions/Loyalty/Barista vẫn là demo localStorage hoặc REST adapter chưa có server. `NEXT_PUBLIC_DATA_MODE` là `mock` hoặc `api`, không fallback ngầm.

Backend Prisma `backend/prisma/schema.prisma`, migration `backend/prisma/migrations`, auth `backend/src/auth`, products `backend/src/products`, seed Barista qua biến môi trường. Role CUSTOMER/BARISTA. Mọi đơn mới PENDING, thanh toán xác nhận mới PAID; PAYMENT_FAILED giữ giỏ; UNKNOWN không tự thành công; PAID → PREPARING → READY → COMPLETED. Hủy chỉ từ PENDING/PAID/PAYMENT_FAILED. Giá tiền số nguyên VND. Backend tương lai tính giá và tồn kho lại.

Kiểm tra hiện tại: frontend build/lint và 6 unit tests qua; backend build/lint, Prisma validate và 45 tests qua. Compose/PostgreSQL/auth/Products và Playwright mock/API mode đã qua ở lượt trước; Payment migration/API E2E chưa chạy vì thiếu OrdersModule. Ưu tiên: TV4 cung cấp `PAYMENT_ORDER_PORT`, bật PaymentsModule, migrate DB và mở rộng E2E sang Orders/Payments thật; TV6 bổ sung History/Promotion/Loyalty theo `docs/API_CONTRACT.md`.
