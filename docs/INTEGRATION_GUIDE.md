# Hướng dẫn tích hợp backend

## Ghi chú TV1 2026-10-16

Trước khi chạy backend mới trên DB nhóm, áp dụng migration `20261016000000_session_version` bằng `npm run db:migrate` sau khi đã xác nhận `DATABASE_URL`. Không dùng `prisma db push` để thay thế migration này. Token JWT cũ vẫn được nhận khi version DB bằng 0; sau logout lần đầu, chúng hết hiệu lực. Frontend nghe sự kiện 401 và xóa user khỏi auth context.

Barista UI hiện dùng `BaristaOrderService` trong `frontend/src/services/contracts.ts`. Mock và API adapter ở `services/mock.ts`, `services/api.ts`; API mode không tự dùng mock nếu Staff Orders trả 404/500. TV4 cần thực hiện đúng 4 endpoint trong `API_CONTRACT.md` và trả `completedAt` khi COMPLETED. Hủy PREPARING đang bị khóa theo state machine hiện tại; nếu muốn mở, thống nhất với TV4/TV5 về tồn kho và hoàn tiền trước. Cần thêm test quyền 401/403, ownership và race transition với backend thật sau khi TV4 tích hợp.

1. Đọc `frontend/src/types/domain.ts`, `frontend/src/services/contracts.ts` và `docs/API_CONTRACT.md`.
2. Xây endpoint trong NestJS theo owner. Không sửa component để gắn fetch trực tiếp; sửa adapter `frontend/src/services/api.ts` khi response khác hợp đồng. Backend tự xác nhận giá, số lượng, role và ownership.
3. Khởi động PostgreSQL, migrate, seed, backend. Đặt `NEXT_PUBLIC_DATA_MODE=api` trong `frontend/.env.local`; khởi động lại frontend vì biến `NEXT_PUBLIC_*` được bundle khi build. Auth không dùng mock ở cả hai mode.
4. Dùng `request()` ở `frontend/src/services/http.ts` để gửi cookie, xử lý lỗi 401/403. Endpoint bảo vệ dùng `JwtAuthGuard`; endpoint nhân viên thêm `@Roles(Role.BARISTA)` và `RolesGuard`. Không tin `userId` từ body để tạo đơn.
5. Kiểm tra cùng một CartItem với S/M/L và topping; backend trả tổng đúng. Tạo đơn PENDING; payment thành công PAID, lỗi PAYMENT_FAILED, timeout UNKNOWN; thử cùng idempotency key không tạo giao dịch kép.
6. Xác nhận `/orders/me` chỉ trả đơn của user hiện tại; `/orders/:id` cũng phải kiểm tra sở hữu. Tạo dữ liệu PAID và đăng nhập Barista để kiểm tra PAID → PREPARING → READY → COMPLETED.

Backend auth, Products và Payment core hiện có test. Frontend adapter API cho Orders/Promotion/Loyalty/Staff vẫn chưa có server; không bật API mode cho demo đầy đủ trước khi những module đó có thật.

## Nối PaymentsModule với OrdersModule

TV4 cần cung cấp một adapter thực hiện `PaymentOrderPort` tại `backend/src/payments/payment.types.ts`. Adapter phải tìm đơn theo cả `orderId` và `userId`, trả tổng tiền tin cậy, và áp dụng `PAID/PAYMENT_FAILED/UNKNOWN` theo state machine một cách idempotent. Sau đó đăng ký module theo dạng:

`PaymentsModule.register({ imports: [OrdersModule], orderProvider: { provide: PAYMENT_ORDER_PORT, useExisting: OrdersService } })`.

Nếu `OrdersService` không trực tiếp khớp interface, dùng `useClass: OrdersPaymentAdapter` trong provider trên. Sau khi bảng `orders` có trong Prisma, thêm khóa ngoại `payments.order_id → orders.id`, import dynamic module vào AppModule, chạy migrate và Payment API E2E. Không thêm fallback mock vào API mode.

`UNKNOWN` không được tự chuyển Order sang PAID. Replay cùng user/key/order/method phải trả Payment đã lưu và không gọi gateway lần hai; key dùng lại với payload khác trả 409.
