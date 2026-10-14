# Hướng dẫn tích hợp backend

1. Đọc `frontend/src/types/domain.ts`, `frontend/src/services/contracts.ts` và `docs/API_CONTRACT.md`.
2. Xây endpoint trong NestJS theo owner. Không sửa component để gắn fetch trực tiếp; sửa adapter `frontend/src/services/api.ts` khi response khác hợp đồng. Backend tự xác nhận giá, số lượng, role và ownership.
3. Khởi động PostgreSQL, migrate, seed, backend. Đặt `NEXT_PUBLIC_DATA_MODE=api` trong `frontend/.env.local`; khởi động lại frontend vì biến `NEXT_PUBLIC_*` được bundle khi build. Auth không dùng mock ở cả hai mode.
4. Dùng `request()` ở `frontend/src/services/http.ts` để gửi cookie, xử lý lỗi 401/403. Endpoint bảo vệ dùng `JwtAuthGuard`; endpoint nhân viên thêm `@Roles(Role.BARISTA)` và `RolesGuard`. Không tin `userId` từ body để tạo đơn.
5. Kiểm tra cùng một CartItem với S/M/L và topping; backend trả tổng đúng. Tạo đơn PENDING; payment thành công PAID, lỗi PAYMENT_FAILED, timeout UNKNOWN; thử cùng idempotency key không tạo giao dịch kép.
6. Xác nhận `/orders/me` chỉ trả đơn của user hiện tại; `/orders/:id` cũng phải kiểm tra sở hữu. Tạo dữ liệu PAID và đăng nhập Barista để kiểm tra PAID → PREPARING → READY → COMPLETED.

Backend auth và Products hiện có test ở `backend/src/auth` và `backend/src/products`. Frontend adapter API cho Orders/Payments/Promotion/Loyalty/Staff là đề xuất chưa có server; không bật API mode cho demo đầy đủ trước khi những module đó có thật.
