# Bàn giao nhóm

| Thành viên | File frontend sẵn có | Backend cần làm | Phụ thuộc và cách xác minh |
|---|---|---|---|
| TV2 Products | `services/api.ts`, trang menu/chi tiết | Rà soát và mở rộng GET `/products`, `/products/:id`, ảnh/stock/size/topping đã có trong Prisma | Migrate + seed, GET JSON đã qua; thử UI API mode, hết hàng và 404 |
| TV3 Options/Cart | `app/products/[id]`, `stores/cart.ts`, `types/domain.ts` | Thống nhất giá size/topping với TV2 và payload cùng TV4 | Thử 2 cấu hình khác nhau, đổi quantity, tổng số nguyên |
| TV4 Orders/Inventory | `app/checkout`, `app/orders`, `services/contracts.ts` | POST `/orders` PENDING, GET `/orders/me`, GET `/orders/:id`, state machine, stock transaction, staff endpoints | Auth guard; race stock; chỉ chủ đơn xem, Barista PAID→COMPLETED |
| TV5 Payments | `app/payment/[id]/[stage]`, `services/payment-intent.ts`, `backend/src/payments`, Prisma Payment migration | Core POST `/payments`, mock gateway và idempotency đã có; còn nối `PAYMENT_ORDER_PORT`, bật module và DB/API E2E | 6 frontend tests + 45 backend tests qua; cùng key không charge lại, timeout thành UNKNOWN |
| TV6 Promotions/Loyalty/History | `app/profile`, `app/orders`, `services/contracts.ts` | Validate promotion, tích điểm sau PAID, history query | Mã sai bị từ chối; chỉ cộng điểm một lần; trả điểm 0 hợp lệ |

TV1 duy trì auth, shell/UI chung, Docker/docs. Mỗi PR cập nhật `docs/PROJECT_STATUS.md`, test liên quan và hợp đồng nếu thay đổi. Request/response dự kiến chi tiết trong `docs/API_CONTRACT.md`.
