# Ngữ cảnh dự án cho phiên làm việc tiếp theo

## Cập nhật VNPAY — 2026-10-21

Làm việc trên nhánh hiện có `feature/payment-demo-persistence`. Payment đang được chuyển từ mock đồng bộ sang VNPAY WebPay 2.1.0: checkout chỉ chọn `VNPAY_QR`, `POST /payments` tạo Payment PROCESSING và URL HMAC-SHA512, trang hosted của VNPAY hiển thị QR, IPN là nguồn xác nhận chính và QueryDR có chữ ký là fallback khi IPN trễ/mất; Return chỉ điều hướng về màn hình frontend poll Order. Không đưa `VNPAY_HASH_SECRET` vào frontend và không tự mã hóa payment URL thành QR.

Migration mới là `20261021000000_vnpay_gateway`. Chế độ nghiệm thu là `NEXT_PUBLIC_DATA_MODE=api`; mock/hybrid chỉ còn phục vụ phát triển module khác. Workspace đã có cấu hình VNPAY TEST trong `.env` ignored; ngày 2026-10-22 VNPAY xác nhận đã active `VNPAYQR` cho terminal, backend local đã bật bank code và tunnel IPN HTTPS đang hoạt động. Chưa đánh dấu sandbox/production VERIFIED_COMPLETE vì URL IPN còn phải được cấu hình trong VSM và chưa quan sát callback IPN thật cho một giao dịch QR TEST mới. Xem contract hiện hành tại `API_CONTRACT.md` và cấu hình tại `INTEGRATION_GUIDE.md`.

Nhánh đã nhập `origin/main:cff6ff0` ngày 2026-10-22. Hiện có Promotions/Loyalty/LoyaltyLog và Staff cancel từ `main`; VNPAY giữ luồng bất đồng bộ. Sau merge, backend 20 suite/253 test không-DB, backend E2E 6 suite/126 test, frontend 20/20 unit + lint + build và Payment PostgreSQL 7 suite/101 test trên database tạm đủ 13 migration đều PASS. Database tạm đã được xóa. Orders là owner duy nhất của phép cộng điểm khi chuyển PAID; Payment adapter chỉ ghi LoyaltyLog và xóa giỏ trong cùng transaction.

## Lịch sử: cập nhật sau khi nhập origin/main ngày 2026-10-16

Làm việc trên **nhánh hiện có** `feature/auth-and-base`. Không tạo nhánh mới. Nguồn thiết kế vẫn là toàn bộ 9 export `stitch/`; trang hồ sơ và Barista KDS đã được chỉnh theo ảnh, với 5 route Barista. `frontend/src/components/barista-board.tsx` là UI chính, `barista-board.css` là CSS; `frontend/src/app/barista/[view]/page.tsx` dùng cho orders/preparing/ready/history. Customer shell được ẩn trên staff route.

Auth thật có thêm `users.session_version` và migration `20261016000000_session_version`; đăng xuất tăng version để token cũ trả 401, kể cả bản sao cookie. Đây là invalidation ở cấp tài khoản (mọi thiết bị). `/auth/me` vẫn là nguồn khôi phục phiên; response auth có `Cache-Control: no-store`. Cần `prisma migrate deploy` trên DB nhóm trước khi chạy backend build mới. Test trên DB QA `brewlite_auth_test` đã migrate/seed và chạy HTTP smoke; không sửa dữ liệu DB phát triển.

Mock Barista/Customer dùng chung key localStorage `brewlite-demo-orders-v1`; các transition có kiểm tra trạng thái, hủy cần lý do. API adapter dùng `/staff/orders`, `/staff/orders/:id`, `PATCH /status`, `PATCH /cancel` và không fallback khi API mode lỗi. TV4 đã có list/transition; detail riêng, hủy có lý do, danh sách lịch sử terminal và `completedAt` chưa có. PENDING/PAID/PAYMENT_FAILED được hủy trong mock; PREPARING chưa hỗ trợ.

Bằng chứng sau merge: Docker backend build PASS; 18 suites/168 tests PASS trên DB PostgreSQL tạm với đủ 8 migrations, DB tạm đã dọn; frontend build/lint và 13 unit tests PASS. Test HTTP Orders cần thêm `sessionVersion:0` vào fixture để tương thích guard Auth, không đổi nghiệp vụ Orders. TV1 trước merge đã có demo Playwright 4/4 và QA 1440/768/390. TV4 đã thêm OrdersModule/InventoryModule, API khách/staff, snapshot/history, optimistic locking; Staff còn thiếu detail/hủy lý do/history. TV5 tích hợp `transitionInTransaction`; TV6 tích hợp `ORDER_DISCOUNT`. `NEXT_PUBLIC_DATA_MODE` có **mock/hybrid/api**; Auth luôn API thật.

BrewLite 1.0 là bài tập nhóm 6 người, yêu cầu 10 Task trong `docs/IMPLEMENTATION_PLAN.md`. **Chỉ sửa repo `BrewLite_swe-project_1`**. Repo này ban đầu chỉ có 9 export Stitch; đã thêm Next.js frontend và NestJS backend (backend auth/products được lấy làm nền từ dự án BrewLite bên cạnh, sau đó sửa trong repo này). Không sửa `BrewLite_swe_project_2`.

Nguồn giao diện: `stitch/*/code.html`, ảnh tham chiếu `screen.webp` đã nén từ PNG, và `stitch/artisanal_vietnamese_coffee_ordering/DESIGN.md`. Frontend `frontend/src/app`; state giỏ Zustand `frontend/src/stores/cart.ts`; domain model `frontend/src/types/domain.ts`; service interface/adapters `frontend/src/services`. Auth là API thật; Payment đã nối Orders port và đang dùng VNPAY WebPay/IPN. Promotions/Loyalty đã có backend; Staff API còn thiếu endpoint detail riêng. `NEXT_PUBLIC_DATA_MODE` có `mock`, `hybrid`, `api`, không fallback ngầm; thanh toán VNPAY chỉ dùng `api`.

Backend Prisma `backend/prisma/schema.prisma`, migration `backend/prisma/migrations`, auth `backend/src/auth`, products `backend/src/products`, seed Barista qua biến môi trường. Role CUSTOMER/BARISTA. Mọi đơn mới PENDING, thanh toán xác nhận mới PAID; PAYMENT_FAILED giữ giỏ; UNKNOWN không tự thành công; PAID → PREPARING → READY → COMPLETED. Staff có thể hủy với lý do theo state machine hiện hành. Giá tiền số nguyên VND; backend tính lại giá và tồn kho.

Baseline 2026-10-17: backend Prisma generate/build/lint và 18 suites/165 tests không cần DB qua; hai suite/18 test PostgreSQL Payment mock qua trên database tạm riêng với đủ 9 migration. Đây là bằng chứng lịch sử trước VNPAY, không xác nhận gateway/IPN mới. Kết quả kiểm tra hiện hành được ghi ở `PROJECT_STATUS.md` và `TESTING.md`.
