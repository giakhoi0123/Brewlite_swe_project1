# Bàn giao nhóm

| Thành viên | File frontend sẵn có | Backend cần làm | Phụ thuộc và cách xác minh |
|---|---|---|---|
| TV2 Products | `services/api.ts`, trang menu/chi tiết | Rà soát và mở rộng GET `/products`, `/products/:id`, ảnh/stock/size/topping đã có trong Prisma | Migrate + seed, GET JSON đã qua; thử UI API mode, hết hàng và 404 |
| TV3 Options/Cart | `app/products/[id]`, `stores/cart.ts`, `types/domain.ts` | Thống nhất giá size/topping với TV2 và payload cùng TV4 | Thử 2 cấu hình khác nhau, đổi quantity, tổng số nguyên |
| TV4 Orders/Inventory | `app/checkout`, `app/orders`, `services/contracts.ts` | POST `/orders` PENDING, GET `/orders/me`, GET `/orders/:id`, state machine, stock transaction, staff endpoints | Auth guard; race stock; chỉ chủ đơn xem, Barista PAID→COMPLETED |
| TV5 Payments | `app/payment/[id]/[stage]`, `services/api.ts` | POST `/payments`, mock gateway server, idempotency, PAID/FAILED/UNKNOWN | Cùng key trả cùng kết quả, timeout không tự PAID, retry có kiểm soát |
| TV6 Promotions/Loyalty/History | `app/profile`, `app/orders`, `services/contracts.ts` | Validate promotion, tích điểm sau PAID, history query | Mã sai bị từ chối; chỉ cộng điểm một lần; trả điểm 0 hợp lệ |

TV1 duy trì auth, shell/UI chung, Docker/docs. Mỗi PR cập nhật `docs/PROJECT_STATUS.md`, test liên quan và hợp đồng nếu thay đổi. Request/response dự kiến chi tiết trong `docs/API_CONTRACT.md`.

TV4 đã bổ sung Orders/Inventory trên `feature/orders-and-inventory` ngày 2026-10-15; chưa VERIFIED_COMPLETE vì DB local không chạy. TV5 import OrdersModule, dùng `OrdersService.transitionInTransaction(tx, id, status)` cùng transaction payment/idempotency; retry failed phải reserve lại về PENDING; UNKNOWN giữ nguyên trạng thái/kho. TV6 thay provider `ORDER_DISCOUNT`, dùng tx cho ưu đãi/điểm; hiện mọi mã ưu đãi backend bị từ chối 422. Chi tiết snapshot, release, CAS version, staff API và giới hạn tại `API_CONTRACT.md`. TV2 cần tăng Product.version mỗi lần ghi tồn kho. Không sửa trực tiếp Order.status từ module tích hợp.
