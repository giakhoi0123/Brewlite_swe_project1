# Kiểm chứng bản sửa Payment status

Đây là mốc kiểm chứng status ban đầu. Phần retry/replay/atomicity được tiếp tục trong [PAYMENT_CONSISTENCY_VERIFICATION.md](PAYMENT_CONSISTENCY_VERIFICATION.md); số 80 tests/8 migration bên dưới không phải kết quả mới nhất.

Ngày 2026-10-17; nhánh `feature/fix-payment-status`, nền `origin/main:c2d6922740284a59de06c001f6fa32b06c7fc232`. Trước khi đổi nhánh đã fetch và kiểm tra working tree. File audit và thư mục tmp chưa commit được giữ nguyên, không đưa vào PR.

## Lỗi và thay đổi

Core/gateway trả PAID/PAYMENT_FAILED/UNKNOWN nhưng adapter AppModule nhận SUCCESS/FAILED/UNKNOWN. Vì vậy HTTP trả Payment PAID trong khi Order bị chuyển PAYMENT_FAILED và hoàn kho. Factory không khai báo trả về PaymentOrderPort nên TypeScript không phát hiện hợp đồng sai.

- Dùng alias PaymentResultStatus thống nhất và khai báo rõ kiểu factory PaymentOrderPort, phương thức applyPaymentResult trả Promise<void>.
- Sau khi xác minh ownership trong transaction, truyền PAID/PAYMENT_FAILED trực tiếp cho OrdersService.transitionInTransaction. Giữ nguyên state machine, CAS, history và inventory có sẵn.
- UNKNOWN không chuyển trạng thái hay cộng điểm; kiểm tra cả PENDING và PAYMENT_FAILED.
- Cấp điểm theo chính sách sẵn có chỉ sau transition PAID thành công, cho order.userId, trong cùng transaction Orders/điểm. Không thêm chính sách đổi điểm.

## Kiểm chứng

Suite `backend/src/payments/payment-status.postgres.spec.ts` import AppModule thật, chỉ thay PrismaService để trỏ DB test riêng. Dùng JWT strategy/guard, ValidationPipe, cookie Origin guard, gateway cấu hình môi trường, Payment repository/service, adapter và Orders/Inventory thật; không override gateway hoặc PaymentOrderPort. Fixture tạo bằng OrdersService và PostgreSQL, thanh toán qua HTTP. Một số ca gọi trực tiếp port để kiểm tra ownership/state machine tại chính ranh giới adapter.

Trước sửa, suite 15 ca có **5 FAIL / 10 PASS**: CARD/WALLET PAID sai trạng thái và adapter thiếu ownership cho cả ba kết quả. Sau sửa:

| Kiểm tra | Kết quả |
|---|---|
| Suite mới AppModule + PostgreSQL | 15/15 PASS |
| PaymentsService, Payments HTTP, state machine, Inventory và suite mới | 5 suites / 80 tests PASS, 0 skipped |
| Backend build | PASS |
| Backend lint | PASS |
| Typecheck phạm vi Payment và các import (config tạm chỉ include src/payments/**/*.ts) | PASS |
| Typecheck toàn bộ backend tests | FAIL 5 lỗi có sẵn từ main, liệt kê bên dưới |

15 ca gồm PAID cho CARD/WALLET và điểm/kho/history; PAYMENT_FAILED và hoàn kho; UNKNOWN giữ nguyên PENDING/PAYMENT_FAILED; HTTP sai chủ đơn; adapter sai chủ đơn cho ba kết quả; payload tự đặt status PAID/SUCCESS, userId hoặc amount; thiếu xác thực; chặn PAID từ CANCELLED.

Log chạy sau sửa: [backend-postgres.txt](evidence/payment-status/backend-postgres.txt).

PostgreSQL **15.18** chạy riêng tại loopback 55438 bằng runtime tạm trong repo. Mỗi lượt tạo DB `brewlite_payment_status_<uuid>`, apply đủ 8 migration rồi xóa đúng DB vừa tạo; không reset/migrate DB ứng dụng. Không thay schema hay dependencies dự án. Docker không được dùng trong lượt này.

## Chạy lại

Chuẩn bị PostgreSQL và **database test riêng** đã tạo, không dùng DB demo/chung/sản xuất. Từ repo, thay URL bằng thông tin local của bạn:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@127.0.0.1:5434/brewlite_payment_status_test?schema=public'
$env:ORDERS_TEST_DATABASE_URL = $env:DATABASE_URL
npm.cmd --prefix backend run prisma:generate
npm.cmd --prefix backend run prisma:migrate
npm.cmd --prefix backend test -- --runInBand --runTestsByPath src/payments/payment-status.postgres.spec.ts src/payments/payments.service.spec.ts src/payments/payments.http.spec.ts src/orders/order-state-machine.spec.ts src/inventory/inventory.service.spec.ts
npm.cmd --prefix backend run build
npm.cmd --prefix backend run lint
```

Suite chỉ xóa fixture UUID của chính lượt chạy. Nếu không đặt ORDERS_TEST_DATABASE_URL, suite PostgreSQL bị skipped; đó không phải bằng chứng DB PASS. JWT_SECRET/FRONTEND_ORIGIN/MOCK_PAYMENT_OUTCOME được suite thiết lập và khôi phục, không cần tài khoản thật.

## Giới hạn và bàn giao

Typecheck toàn bộ `tsc --noEmit --incremental false -p backend/tsconfig.test.json` còn 5 lỗi có sẵn trong main: `orders.postgres.spec.ts` và `orders.service.spec.ts` import NoPromotionDiscount đã đổi tên; 2 fixture trong products.http.spec.ts thiếu stock/description; fixture product-detail thiếu stock. Không sửa các phần này trong PR Payment status; nhánh Task 06 đã có công việc liên quan cần tích hợp riêng.

Chưa giải quyết replay kết quả đã áp dụng, retry PAYMENT_FAILED về PENDING và reserve kho, lỗi giữa Payment.finalize và Order transaction, hoặc thanh toán đồng thời nhiều key. Payment.finalize vẫn ở transaction riêng; không tuyên bố atomicity toàn bộ Payment/Order/điểm. Không chạy browser E2E/Compose, không thanh toán tiền thật, không thay UI. T08 và 10B giữ IN_PROGRESS; bản sửa này sẵn sàng review trong phạm vi hợp đồng trạng thái/ownership.
