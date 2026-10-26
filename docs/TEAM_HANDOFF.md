# Bàn giao nhóm

## VNPAY — 2026-10-21

TV5 duy trì `backend/src/payments`: URL WebPay 2.1.0 ký HMAC-SHA512, callback IPN idempotent, Return không ghi DB và migration `20261021000000_vnpay_gateway`. TV1 duy trì checkout/màn xác minh: chỉ `VNPAY_QR`, không có bộ chọn kết quả demo, chỉ xóa giỏ sau khi Order từ backend đã PAID. Sandbox end-to-end cần credential merchant trong backend `.env` và endpoint IPN HTTPS công khai; không gửi `VNPAY_HASH_SECRET` qua chat, frontend hoặc commit.

## Cập nhật workstream TV1 — 2026-10-16

| Người nhận | Việc cần nối tiếp | Contract và phép kiểm tra |
|---|---|---|
| Tri (TV2) | Giữ API Products, ảnh, size/topping/stock đồng bộ với frontend | GET `/products`, `/products/:id`; thử tên dài, hết hàng, 404 |
| Đông (TV3) | Giữ giỏ Zustand (`stores/cart.ts`) và trang chi tiết/giỏ; payload `POST /orders` thống nhất với TV4 | Cùng cấu hình gộp, khác cấu hình tách; giỏ không mất khi reload/đăng nhập. Backend `/cart` + bảng `carts/cart_items` còn nhưng frontend không gọi từ 2026-10-24 |
| Điệp (TV4) | Orders/Inventory đã có và test PostgreSQL sau merge qua; mở rộng Staff API thêm detail, hủy có lý do, terminal history, `completedAt` | `docs/API_CONTRACT.md`; list/status đã có, chưa bật nút hủy trong API mode; cần API browser E2E |
| Kiệt (TV5) | Duy trì VNPAY URL/IPN/Return, idempotency và reconciliation cho attempt PROCESSING quá hạn; hoàn tiền khi hủy nếu sau này có | Chỉ IPN hợp lệ được PAID; replay key không phát hành giao dịch lần hai |
| Duy (TV6) | Orders history, promotion, loyalty API và E2E thật | `/orders/me`, `/promotions/validate`, `/loyalty/me`; điểm chỉ cộng một lần sau PAID; voucher cá nhân hiện **chưa có API**, UI chỉ báo đang chờ |

TV1 đã hoàn thành UI hồ sơ/KDS, Auth session invalidation và adapter. Backend PostgreSQL QA đã chạy cả Orders và Auth sau merge; **DB nhóm vẫn cần áp dụng migration session_version** trước khi chạy mã Auth mới. Orders/Staff browser API E2E và Payment/Promotion/Loyalty API E2E còn chờ. Nhánh hiện hành vẫn `feature/auth-and-base`. Mỗi PR cập nhật API_CONTRACT, TESTING, PROJECT_STATUS và thử trên API mode. Bảng cũ dưới đây là lịch sử.

| Thành viên | File frontend sẵn có | Backend cần làm | Phụ thuộc và cách xác minh |
|---|---|---|---|
| TV2 Products | `services/api.ts`, trang menu/chi tiết | Rà soát và mở rộng GET `/products`, `/products/:id`, ảnh/stock/size/topping đã có trong Prisma | Migrate + seed, GET JSON đã qua; thử UI API mode, hết hàng và 404 |
| TV3 Options/Cart | `app/products/[id]`, `stores/cart.ts`, `types/domain.ts` | Thống nhất giá size/topping với TV2 và payload cùng TV4 | Thử 2 cấu hình khác nhau, đổi quantity, tổng số nguyên |
| TV4 Orders/Inventory | `app/checkout`, `app/orders`, `services/contracts.ts` | POST `/orders` PENDING, GET `/orders/me`, GET `/orders/:id`, state machine, stock transaction, staff endpoints | Auth guard; race stock; chỉ chủ đơn xem, Barista PAID→COMPLETED |
| TV5 Payments | `app/payment/[id]/[stage]`, `services/payment-intent.ts`, `backend/src/payments`, Prisma Payment migration | VNPAY WebPay URL + IPN/Return và idempotency; còn sandbox thật, DB/API E2E và reconciliation PROCESSING quá hạn | Cùng key trả lại attempt; chữ ký/merchant/amount/callback lặp phải có unit test; sandbox chỉ xác nhận khi IPN HTTPS chạy |
| TV6 Promotions/Loyalty/History | `app/profile`, `app/orders`, `services/contracts.ts` | Validate promotion, tích điểm sau PAID, history query | Mã sai bị từ chối; chỉ cộng điểm một lần; trả điểm 0 hợp lệ |

TV1 duy trì auth, shell/UI chung, Docker/docs. Mỗi PR cập nhật `docs/PROJECT_STATUS.md`, test liên quan và hợp đồng nếu thay đổi. Request/response dự kiến chi tiết trong `docs/API_CONTRACT.md`.

TV4 đã bổ sung Orders/Inventory trên `feature/orders-and-inventory` ngày 2026-10-15; chưa VERIFIED_COMPLETE vì DB local không chạy. TV5 import OrdersModule, dùng `OrdersService.transitionInTransaction(tx, id, status)` cùng transaction payment/idempotency; retry failed phải reserve lại về PENDING; UNKNOWN giữ nguyên trạng thái/kho. TV6 thay provider `ORDER_DISCOUNT`, dùng tx cho ưu đãi/điểm; hiện mọi mã ưu đãi backend bị từ chối 422. Chi tiết snapshot, release, CAS version, staff API và giới hạn tại `API_CONTRACT.md`. TV2 cần tăng Product.version mỗi lần ghi tồn kho. Không sửa trực tiếp Order.status từ module tích hợp.


## L?ch s? ri?ng nh?nh TV4 tr??c khi nh?p main ng?y 2026-10-26

C?c b?ng ch?ng d??i ??y thu?c code v? gateway mock ? th?i ?i?m ghi nh?n, kh?ng x?c nh?n phi?n b?n VNPAY hi?n t?i.

## TV4 — nghiệm thu 2026-10-18 theo báo cáo hoàn chỉnh

- Backend T06/T10A/T10C/Barista đã có đủ theo mục 12.1; bổ sung bằng chứng thay vì tạo endpoint trùng. 272 backend tests/25 suites PASS, không skipped; build/lint/typecheck PASS. Browser khách và Barista hai phiên thật PASS tại 1440/768/390. [Ma trận, ảnh và lệnh chạy](TV4_ACCEPTANCE.md).
- TV1: queue/ba bước pha–giao đã chạy trên API thật. Bật nhánh hủy/history/KPI trong `barista-board.tsx` bằng adapter hiện có; GET staff detail, PATCH cancel reason và terminal list đã sẵn sàng. Bỏ placeholder/thông báo “còn chờ TV4”, hiển thị lý do/thời điểm và chạy B05 trên UI thật.
- TV5/TV6: dùng state machine/transaction hiện có; hủy PAID không tự refund. Việc nghiệm thu này không thay quy tắc hoặc code của các owner khác.
- Kiểm chứng dùng PostgreSQL mới có UUID; DB ứng dụng chưa được migrate trong lượt này. Các kết quả/việc chờ endpoint ở mốc cũ bên dưới là lịch sử.

## Bàn giao backend Barista TV4 — 2026-10-16

- Staff detail và cancel đã có theo API_CONTRACT; status chỉ nhận PREPARING/READY/COMPLETED. Cancel dùng `{reason}` (trim, 1–300 ký tự), từ PENDING/PAID/PAYMENT_FAILED; sai bước/lặp/race trả 409, không hoàn kho lần hai.
- GET `/staff/orders` giữ mảng Order, bổ sung COMPLETED/CANCELLED bên cạnh hàng đang xử lý. Có `customerName`, `cancelReason?`, `completedAt?`; adapter hiện tại của TV1 dùng được. Danh sách chưa phân trang, phù hợp quy mô demo.
- TV1: bật các nhánh API mode đang khóa history/KPI/nút hủy trong `frontend/src/components/barista-board.tsx`; có thể gọi `services.barista.get(id)` để tải chi tiết mới nhất. Lượt TV4 này chỉ sửa backend/docs, chưa thay UI và chưa chạy browser E2E.
- Khi triển khai, chạy migration mới `20261016000100_staff_order_details` trước backend. `docker compose up -d --build backend` dùng CMD hiện có để migrate deploy. Cột mới nullable; completedAt cũ chỉ backfill nếu có sự kiện COMPLETED thật; lý do hủy cũ giữ trống.
- TV5/TV6: `transitionInTransaction(tx,id,status)` vẫn dùng cho thanh toán; riêng CANCELLED bắt buộc tham số thứ tư `reason`. Không ghi trực tiếp Order.status. Hủy PAID không tự hoàn tiền.
- Bằng chứng: backend build local/Docker + lint PASS; full Jest **191/191**, gồm 22 PostgreSQL tests, 9 migrations trên DB tạm đã dọn. Typecheck toàn bộ tests còn lỗi Products có sẵn; xem TESTING.md.
