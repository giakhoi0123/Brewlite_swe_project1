# Bàn giao nhóm

## Cập nhật workstream TV1 — 2026-10-16

| Người nhận | Việc cần nối tiếp | Contract và phép kiểm tra |
|---|---|---|
| Tri (TV2) | Giữ API Products, ảnh, size/topping/stock đồng bộ với frontend | GET `/products`, `/products/:id`; thử tên dài, hết hàng, 404 |
| Đông (TV3) | Giữ Cart API, đồng bộ giá/tồn kho với đơn của TV4 | Bảng `carts/cart_items`; cùng cấu hình gộp, khác cấu hình tách; giỏ không mất khi đăng nhập |
| Điệp (TV4) | Làm Orders/Inventory và **4 Staff Orders API** cho KDS đã có; xác nhận state machine, `completedAt`, reason | `docs/API_CONTRACT.md`; 401/403; không nhận PENDING vào queue; ownership; race transition; PAID→PREPARING→READY→COMPLETED |
| Kiệt (TV5) | Nối `PAYMENT_ORDER_PORT` với TV4, bật module và migration; xác nhận UNKNOWN, idempotency, hoàn tiền khi hủy nếu sau này có | Không tự PAID khi gateway chưa chắc; replay key không charge lại |
| Duy (TV6) | Orders history, promotion, loyalty API và E2E thật | `/orders/me`, `/promotions/validate`, `/loyalty/me`; điểm chỉ cộng một lần sau PAID; voucher cá nhân hiện **chưa có API**, UI chỉ báo đang chờ |

TV1 đã hoàn thành UI hồ sơ/KDS, Auth session invalidation và adapter. Backend QA PostgreSQL đã migrate/test riêng; **DB nhóm cần áp dụng migration session_version** trước khi chạy mã Auth mới. Staff Orders, Orders, Payment endpoint, Promotion/Loyalty chưa có E2E thật. Nhánh hiện hành vẫn `feature/auth-and-base`. Mỗi PR của module backend cần cập nhật API_CONTRACT, TESTING, PROJECT_STATUS và thử trên API mode. Bảng cũ dưới đây là lịch sử bàn giao trước lượt này.

| Thành viên | File frontend sẵn có | Backend cần làm | Phụ thuộc và cách xác minh |
|---|---|---|---|
| TV2 Products | `services/api.ts`, trang menu/chi tiết | Rà soát và mở rộng GET `/products`, `/products/:id`, ảnh/stock/size/topping đã có trong Prisma | Migrate + seed, GET JSON đã qua; thử UI API mode, hết hàng và 404 |
| TV3 Options/Cart | `app/products/[id]`, `stores/cart.ts`, `types/domain.ts` | Thống nhất giá size/topping với TV2 và payload cùng TV4 | Thử 2 cấu hình khác nhau, đổi quantity, tổng số nguyên |
| TV4 Orders/Inventory | `app/checkout`, `app/orders`, `services/contracts.ts` | POST `/orders` PENDING, GET `/orders/me`, GET `/orders/:id`, state machine, stock transaction, staff endpoints | Auth guard; race stock; chỉ chủ đơn xem, Barista PAID→COMPLETED |
| TV5 Payments | `app/payment/[id]/[stage]`, `services/payment-intent.ts`, `backend/src/payments`, Prisma Payment migration | Core POST `/payments`, mock gateway và idempotency đã có; còn nối `PAYMENT_ORDER_PORT`, bật module và DB/API E2E | 6 frontend tests + 45 backend tests qua; cùng key không charge lại, timeout thành UNKNOWN |
| TV6 Promotions/Loyalty/History | `app/profile`, `app/orders`, `services/contracts.ts` | Validate promotion, tích điểm sau PAID, history query | Mã sai bị từ chối; chỉ cộng điểm một lần; trả điểm 0 hợp lệ |

TV1 duy trì auth, shell/UI chung, Docker/docs. Mỗi PR cập nhật `docs/PROJECT_STATUS.md`, test liên quan và hợp đồng nếu thay đổi. Request/response dự kiến chi tiết trong `docs/API_CONTRACT.md`.
