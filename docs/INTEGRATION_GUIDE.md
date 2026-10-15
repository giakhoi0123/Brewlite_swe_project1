# Hướng dẫn tích hợp backend

## Ghi chú TV1 2026-10-16

Trước khi chạy backend mới trên DB nhóm, áp dụng migration `20261016000000_session_version` bằng `npm run db:migrate` sau khi đã xác nhận `DATABASE_URL`. Không dùng `prisma db push` để thay thế migration này. Token JWT cũ vẫn được nhận khi version DB bằng 0; sau logout lần đầu, chúng hết hiệu lực. Frontend nghe sự kiện 401 và xóa user khỏi auth context.

Barista UI dùng `BaristaOrderService` trong `frontend/src/services/contracts.ts`. Mock và API adapter ở `services/mock.ts`, `services/api.ts`; API mode không tự dùng mock nếu Staff Orders trả 404/500. TV4 đã có GET list và PATCH status; còn GET detail, PATCH cancel có lý do, terminal history và `completedAt`. Vì vậy UI API mode chỉ bật queue/transition, ghi rõ phần chờ và ẩn nút hủy. Hủy PREPARING đang khóa theo state machine hiện tại; nếu muốn mở, thống nhất với TV4/TV5 về tồn kho và hoàn tiền. Cần browser API E2E cho luồng staff khi payment có nguồn PAID.

1. Đọc `frontend/src/types/domain.ts`, `frontend/src/services/contracts.ts` và `docs/API_CONTRACT.md`.
2. Xây endpoint trong NestJS theo owner. Không sửa component để gắn fetch trực tiếp; sửa adapter `frontend/src/services/api.ts` khi response khác hợp đồng. Backend tự xác nhận giá, số lượng, role và ownership.
3. Khởi động PostgreSQL, migrate, seed, backend. Đặt `NEXT_PUBLIC_DATA_MODE=api` trong `frontend/.env.local`; khởi động lại frontend vì biến `NEXT_PUBLIC_*` được bundle khi build. Auth không dùng mock ở cả hai mode.
4. Dùng `request()` ở `frontend/src/services/http.ts` để gửi cookie, xử lý lỗi 401/403. Endpoint bảo vệ dùng `JwtAuthGuard`; endpoint nhân viên thêm `@Roles(Role.BARISTA)` và `RolesGuard`. Không tin `userId` từ body để tạo đơn.
5. Kiểm tra cùng một CartItem với S/M/L và topping; backend trả tổng đúng. Tạo đơn PENDING; payment thành công PAID, lỗi PAYMENT_FAILED, timeout UNKNOWN; thử cùng idempotency key không tạo giao dịch kép.
6. Xác nhận `/orders/me` chỉ trả đơn của user hiện tại; `/orders/:id` cũng phải kiểm tra sở hữu. Tạo dữ liệu PAID và đăng nhập Barista để kiểm tra PAID → PREPARING → READY → COMPLETED.

Backend Auth, Products, Cart, Orders/Inventory và Payment core hiện có test. Orders/Staff cơ bản đã có server và đã chạy PostgreSQL tests sau merge; Promotion/Loyalty và Payment endpoint còn thiếu, Staff detail/hủy/history chưa có. API mode không thể demo luồng thanh toán đầy đủ trước khi TV5/TV6 nối module.

## Nối PaymentsModule với OrdersModule

TV4 cần cung cấp một adapter thực hiện `PaymentOrderPort` tại `backend/src/payments/payment.types.ts`. Adapter phải tìm đơn theo cả `orderId` và `userId`, trả tổng tiền tin cậy, và áp dụng `PAID/PAYMENT_FAILED/UNKNOWN` theo state machine một cách idempotent. Sau đó đăng ký module theo dạng:

`PaymentsModule.register({ imports: [OrdersModule], orderProvider: { provide: PAYMENT_ORDER_PORT, useExisting: OrdersService } })`.

Nếu `OrdersService` không trực tiếp khớp interface, dùng `useClass: OrdersPaymentAdapter` trong provider trên. Sau khi bảng `orders` có trong Prisma, thêm khóa ngoại `payments.order_id → orders.id`, import dynamic module vào AppModule, chạy migrate và Payment API E2E. Không thêm fallback mock vào API mode.

`UNKNOWN` không được tự chuyển Order sang PAID. Replay cùng user/key/order/method phải trả Payment đã lưu và không gọi gateway lần hai; key dùng lại với payload khác trả 409.
