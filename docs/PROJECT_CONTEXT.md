# Ngữ cảnh dự án cho phiên làm việc tiếp theo

## Backend Barista TV4 — trạng thái được giữ khi nhập main 2026-10-18

Nhánh `feature/orders-and-inventory` giữ API staff detail/cancel reason và terminal history từ commit `abd7343` khi nhập `origin/main:b87db13`. Order có `cancelReason`/`completedAt` qua migration `20261016000100_staff_order_details`; chỉ PENDING/PAID/PAYMENT_FAILED được hủy. Reason, trạng thái, hoàn kho và history nằm cùng transaction/CAS; completedAt ghi lúc READY→COMPLETED. Sau merge đã sửa một fixture Payment dùng lối hủy cũ, rồi backend build local/Docker, lint và **25 suites/270 tests PASS** trên PostgreSQL thật với đủ 11 migrations; DB tạm đã dọn.

## Task 06 review — 2026-10-17, mới nhất

Nhánh hiện tại `feature/task-06-orders`, cập nhật PR #16 có sẵn thay vì tạo PR trùng. 5 commit gốc đến `03ff19b` giữ nguyên; PR #13 đã đóng chưa merge. Nền main `bacb7a6` đã có Payment consistency #18; merge commit `2c8adc2` giữ nguyên Payment/Promotion/Staff/main và chỉ giải quyết conflict tài liệu. Backend test:postgres giờ đặt cả ORDERS_TEST_DATABASE_URL và PAYMENTS_TEST_DATABASE_URL cho DB UUID riêng, tránh skipped suite Payment.

247 backend tests PostgreSQL/0 skipped; frontend unit 14; browser Task 06 API 4 (1440/768/390 + stock409) PASS, cùng build/lint/typecheck backend và frontend Webpack build. Frontend lint toàn repo còn lỗi profile memoization; scoped lint E2E/config PASS. T06 READY_FOR_REVIEW, chưa merge. Browser chỉ PENDING, abort Payment, không suy ra T08 hoàn thành. Xem [TASK06_REVIEW_VERIFICATION.md](TASK06_REVIEW_VERIFICATION.md) và evidence/task06-review. Các ghi chú nhánh/test phía dưới là lịch sử.

## Payment consistency — 2026-10-17, cập nhật mới nhất

Đã merge `origin/main:808077f` vào nhánh làm việc sau khi PR #15/#17 được merge trong lúc thực hiện. Bảo toàn sandbox demoOutcome/FK/Orders.preparePaymentRetry và UI của main; consistency được review qua PR #18. Script test tự đặt cả ORDERS_TEST_DATABASE_URL và PAYMENTS_TEST_DATABASE_URL cho DB UUID riêng.

Nhánh hiện tại `feature/fix-payment-status`; giữ nhánh theo AGENTS, PR #18 từ nền `faea93e` đã có status fix `b6ca9ac`. PaymentOrderPort có `prepareAttempt(input,tx)` để retry reserve PENDING và `applyPaymentResult(input,tx?)` để dùng chung transaction với Payment.finalize. PaymentsRepository khóa Order khi claim/settle; gateway chạy ngoài transaction, dùng key Payment.id. `gatewayStatus` là journal trước settle, `appliedAt` ghi cùng transaction Order/điểm. Final replay không áp dụng transition/điểm lần nữa.

Migration mới `20261017000000_payment_consistency`; phải audit Payment cũ trước deploy, partial unique index từ chối duplicate live attempts thay vì xóa dữ liệu. UNKNOWN/PROCESSING thiếu journal không tự mở khóa hoặc charge lại; chưa có API reconciliation. 111 tests liên quan PASS, gồm 40 PostgreSQL (hai AppModule/connection độc lập); build/lint/Payment typecheck PASS. Full test typecheck còn 5 lỗi baseline, browser/Compose/đối soát provider chưa chốt. Xem [PAYMENT_CONSISTENCY_VERIFICATION.md](PAYMENT_CONSISTENCY_VERIFICATION.md). Những mốc thiếu Orders port/Payment endpoint và pending retry/replay phía dưới là lịch sử.

## Cập nhật sau khi nhập origin/main ngày 2026-10-16

Làm việc trên **nhánh hiện có** `feature/auth-and-base`. Không tạo nhánh mới. Nguồn thiết kế vẫn là toàn bộ 9 export `stitch/`; trang hồ sơ và Barista KDS đã được chỉnh theo ảnh, với 5 route Barista. `frontend/src/components/barista-board.tsx` là UI chính, `barista-board.css` là CSS; `frontend/src/app/barista/[view]/page.tsx` dùng cho orders/preparing/ready/history. Customer shell được ẩn trên staff route.

Auth thật có thêm `users.session_version` và migration `20261016000000_session_version`; đăng xuất tăng version để token cũ trả 401, kể cả bản sao cookie. Đây là invalidation ở cấp tài khoản (mọi thiết bị). `/auth/me` vẫn là nguồn khôi phục phiên; response auth có `Cache-Control: no-store`. Cần `prisma migrate deploy` trên DB nhóm trước khi chạy backend build mới. Test trên DB QA `brewlite_auth_test` đã migrate/seed và chạy HTTP smoke; không sửa dữ liệu DB phát triển.

Mock Barista/Customer dùng chung key localStorage `brewlite-demo-orders-v1`; các transition có kiểm tra trạng thái, hủy cần lý do. API adapter dùng `/staff/orders`, `/staff/orders/:id`, `PATCH /status`, `PATCH /cancel` và không fallback khi API mode lỗi. TV4 đã có list/transition; detail riêng, hủy có lý do, danh sách lịch sử terminal và `completedAt` chưa có. PENDING/PAID/PAYMENT_FAILED được hủy trong mock; PREPARING chưa hỗ trợ.

Bằng chứng sau merge: Docker backend build PASS; 18 suites/168 tests PASS trên DB PostgreSQL tạm với đủ 8 migrations, DB tạm đã dọn; frontend build/lint và 13 unit tests PASS. Test HTTP Orders cần thêm `sessionVersion:0` vào fixture để tương thích guard Auth, không đổi nghiệp vụ Orders. TV1 trước merge đã có demo Playwright 4/4 và QA 1440/768/390. TV4 đã thêm OrdersModule/InventoryModule, API khách/staff, snapshot/history, optimistic locking; Staff còn thiếu detail/hủy lý do/history. TV5 tích hợp `transitionInTransaction`; TV6 tích hợp `ORDER_DISCOUNT`. `NEXT_PUBLIC_DATA_MODE` có **mock/hybrid/api**; Auth luôn API thật.

BrewLite 1.0 là bài tập nhóm 6 người, yêu cầu 10 Task trong `docs/IMPLEMENTATION_PLAN.md`. **Chỉ sửa repo `BrewLite_swe-project_1`**. Repo này ban đầu chỉ có 9 export Stitch; đã thêm Next.js frontend và NestJS backend (backend auth/products được lấy làm nền từ dự án BrewLite bên cạnh, sau đó sửa trong repo này). Không sửa `BrewLite_swe_project_2`.

Nguồn giao diện: `stitch/*/code.html`, ảnh tham chiếu `screen.webp` đã nén từ PNG, và `stitch/artisanal_vietnamese_coffee_ordering/DESIGN.md`. Frontend `frontend/src/app`; state giỏ Zustand `frontend/src/stores/cart.ts`; domain model `frontend/src/types/domain.ts`; service interface/adapters `frontend/src/services`. Auth là API thật; Payment đã nối Orders port và bật endpoint trong AppModule, có migration foreign key Payment→Order. Promotions vẫn chưa hoàn chỉnh; Staff API còn thiếu detail/hủy/history. `NEXT_PUBLIC_DATA_MODE` có `mock`, `hybrid`, `api`, không fallback ngầm.

Backend Prisma `backend/prisma/schema.prisma`, migration `backend/prisma/migrations`, auth `backend/src/auth`, products `backend/src/products`, seed Barista qua biến môi trường. Role CUSTOMER/BARISTA. Mọi đơn mới PENDING, thanh toán xác nhận mới PAID; PAYMENT_FAILED giữ giỏ; UNKNOWN không tự thành công; PAID → PREPARING → READY → COMPLETED. Hủy chỉ từ PENDING/PAID/PAYMENT_FAILED. Giá tiền số nguyên VND. Backend tương lai tính giá và tồn kho lại.

Kiểm tra hiện tại 2026-10-17: backend Prisma generate/build/lint và 18 suites/165 tests không cần DB qua. Hai suite/18 test PostgreSQL Payment qua trên database tạm riêng với đủ 9 migration; HTTP smoke Order→Payment và truy vấn DB trực tiếp xác nhận PAID/PAID, amount 29.000 và hai status history. Browser API E2E riêng xác nhận PAYMENT_FAILED→checkout→PAID trên cùng order; ưu tiên tiếp theo là mở rộng UNKNOWN/Wallet.
