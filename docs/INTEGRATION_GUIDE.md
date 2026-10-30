# Hướng dẫn tích hợp backend

## VNPAY WebPay 2.1.0 — 2026-10-21

1. Đặt `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_QUERY_URL`, `VNPAY_QUERY_IP_ADDRESS`, `VNPAY_RETURN_URL` và `FRONTEND_PUBLIC_URL` trong biến môi trường **backend**. Với TEST, `VNPAY_QUERY_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction`; `VNPAY_QUERY_IP_ADDRESS` là IP server gửi trong request QueryDR. `VNPAY_BANK_CODE` là tùy chọn: mặc định để trống; chỉ đặt `VNPAYQR` khi VNPAY xác nhận terminal TEST đã được bật kênh QR. Không đưa secret hoặc cấu hình merchant vào biến `NEXT_PUBLIC_*`, image frontend hoặc repository.
2. `VNPAY_RETURN_URL` trỏ tới `GET /api/payments/vnpay/return`. Khi chạy sandbox, URL backend/IPN phải là HTTPS công khai để VNPAY gọi được; `localhost` chỉ phù hợp phát triển giao diện cục bộ.
3. Chạy migration `20261021000000_vnpay_gateway`, sau đó khởi động backend và frontend với `NEXT_PUBLIC_DATA_MODE=api`.
4. Checkout tạo Order PENDING rồi gọi `POST /api/payments` với `{ orderId, method: "VNPAY_QR", idempotencyKey }`. Backend trả Payment PROCESSING cùng `paymentUrl`; frontend chỉ chuyển hướng tới URL HTTPS này.
5. Trang hosted của VNPAY hiển thị các phương thức terminal được cấp. Khi `VNPAY_BANK_CODE` để trống, backend không gửi `vnp_BankCode`; khi đặt `VNPAYQR`, VNPAY sẽ mở luồng QR nếu merchant TEST có quyền tương ứng. `GET /api/payments/vnpay/ipn` là nguồn xác nhận thanh toán chính: backend kiểm tra HMAC-SHA512, `vnp_TmnCode`, `vnp_TxnRef` và `vnp_Amount` trước khi cập nhật Payment/Order trong transaction. Callback lặp lại phải idempotent.
6. Nếu IPN bị trễ/mất, frontend gọi owner-auth `POST /api/payments/:orderId/reconcile`. Backend chỉ truy vấn Payment `PROCESSING`, gửi QueryDR có chữ ký, kiểm chữ ký response cùng command/merchant/reference/amount/type, rồi mới finalize `PAID` (`vnp_TransactionStatus=00`) hoặc `PAYMENT_FAILED` cho lỗi/hết hạn/hủy rõ ràng (`02`, `08`, `11`) trong cùng transaction. Trạng thái đảo giao dịch, hoàn tiền, nghi ngờ gian lận, lifecycle khác hoặc mã query lỗi giữ nguyên `PROCESSING`; không đoán kết quả và không mở thanh toán lại khi khách có thể đã bị trừ tiền.
7. Return URL không xác nhận thanh toán và không ghi DB. Chữ ký/reference/amount hợp lệ với mã thành công chuyển về `/payment/:orderId/verifying`; mã Return không thành công chuyển về `/payment/:orderId/unknown`; callback không hợp lệ chuyển `/payment/error`. Màn `verifying` đọc Order mỗi 2 giây và gọi QueryDR có giới hạn tại lần 1/4/8/12/18/24/30, tối đa 30 lần; nút “Kiểm tra trạng thái đơn” gọi QueryDR lại trước khi đọc Order. Màn hình kết quả chỉ đọc Order thuộc user hiện tại và chỉ xóa giỏ khi server trả PAID.

Credential WebPay tiêu chuẩn không cung cấp ảnh/payload QR để BrewLite tự render. Nếu merchant đã được cấp thêm Dynamic QR API, cần một hợp đồng tích hợp riêng; không mã hóa `paymentUrl` thành QR giả.

Xử lý lỗi TEST ngày 2026-10-22: trang hosted từng trả “Ngân hàng thanh toán không được hỗ trợ” khi request ép `vnp_BankCode=VNPAYQR`. Sau khi bộ phận kỹ thuật VNPAY xác nhận đã active kênh QR cho đúng terminal TEST, cấu hình local được đặt `VNPAY_BANK_CODE=VNPAYQR`, backend được recreate và URL ký thử đã chứa đúng bank code. File mẫu vẫn để trống vì quyền QR phụ thuộc từng terminal.

Sau khi thanh toán bằng tài khoản TEST `NGUYEN VAN A`, QueryDR đã khôi phục giao dịch Order `66e28a10-a95e-45ee-b877-a1617e9c3abf` và DB lưu Order/Payment `PAID`, transaction no `15711511`, bank `NCB`, pay date `20261022114118`, idempotency key `3998d99e-ff66-4ee6-a204-0a22cc35b60c`. Kết quả này xác minh fallback QueryDR; vẫn phải cấu hình IPN HTTPS trong portal và kiểm tra callback server-to-server trước khi chốt E2E IPN.

QR Sandbox có thể báo “QR không tồn tại” nếu quét bằng ứng dụng ngân hàng LIVE vì VNPAY tách môi trường TEST/LIVE. Dùng ứng dụng QR TEST iOS/Android và công cụ VSM Sandbox do VNPAY cung cấp qua email; trong VSM cấu hình IPN HTTPS công khai rồi dùng NCB test theo hướng dẫn. Không lưu credential VSM trong repo/log, không dùng ứng dụng LIVE thất bại để kết luận checksum sai, và không coi việc hiển thị QR là bằng chứng thanh toán thành công.

Nếu Return đưa tới UNKNOWN khi Payment vẫn `PROCESSING`, nút “Thử lại” đi qua `/checkout?resumeOrder=<orderId>` và phải giữ nguyên payment intent/idempotency key; replay `POST /payments` trả lại Payment/URL hiện tại, không tạo Order hoặc Payment mới. Chỉ dùng `/checkout?retryOrder=<orderId>` cùng key mới sau khi IPN hoặc QueryDR hợp lệ đã chốt Payment thành `PAYMENT_FAILED`.

## Ghi chú TV1 2026-10-16

Trước khi chạy backend mới trên DB nhóm, áp dụng migration `20261016000000_session_version` bằng `npm run db:migrate` sau khi đã xác nhận `DATABASE_URL`. Không dùng `prisma db push` để thay thế migration này. Token JWT cũ vẫn được nhận khi version DB bằng 0; sau logout lần đầu, chúng hết hiệu lực. Frontend nghe sự kiện 401 và xóa user khỏi auth context.

Barista UI dùng `BaristaOrderService` trong `frontend/src/services/contracts.ts`. Mock và API adapter ở `services/mock.ts`, `services/api.ts`; API mode không tự dùng mock nếu Staff Orders trả 404/500. TV4 đã có GET list và PATCH status; còn GET detail, PATCH cancel có lý do, terminal history và `completedAt`. Vì vậy UI API mode chỉ bật queue/transition, ghi rõ phần chờ và ẩn nút hủy. Hủy PREPARING đang khóa theo state machine hiện tại; nếu muốn mở, thống nhất với TV4/TV5 về tồn kho và hoàn tiền. Cần browser API E2E cho luồng staff khi payment có nguồn PAID.

1. Đọc `frontend/src/types/domain.ts`, `frontend/src/services/contracts.ts` và `docs/API_CONTRACT.md`.
2. Xây endpoint trong NestJS theo owner. Không sửa component để gắn fetch trực tiếp; sửa adapter `frontend/src/services/api.ts` khi response khác hợp đồng. Backend tự xác nhận giá, số lượng, role và ownership.
3. Khởi động PostgreSQL, migrate, seed, backend. Đặt `NEXT_PUBLIC_DATA_MODE=api` trong `frontend/.env.local`; khởi động lại frontend vì biến `NEXT_PUBLIC_*` được bundle khi build. Auth không dùng mock ở cả hai mode.
4. Dùng `request()` ở `frontend/src/services/http.ts` để gửi cookie, xử lý lỗi 401/403. Endpoint bảo vệ dùng `JwtAuthGuard`; endpoint nhân viên thêm `@Roles(Role.BARISTA)` và `RolesGuard`. Không tin `userId` từ body để tạo đơn.
5. Kiểm tra cùng một CartItem với S/M/L và topping; backend trả tổng đúng. Tạo đơn PENDING; Payment chuyển PROCESSING khi phát hành URL, PAID khi IPN báo cả response code và transaction status là `00`, PAYMENT_FAILED chỉ với lỗi cuối rõ ràng; trạng thái đảo/nghi vấn/hoàn tiền giữ PROCESSING để đối soát. Thử cùng idempotency key không tạo giao dịch kép.
6. Xác nhận `/orders/me` chỉ trả đơn của user hiện tại; `/orders/:id` cũng phải kiểm tra sở hữu. Tạo dữ liệu PAID và đăng nhập Barista để kiểm tra PAID → PREPARING → READY → COMPLETED.

Backend Auth, Products, Cart, Orders/Inventory và Payment có test. Orders/Staff cơ bản đã có server; Promotion/Loyalty và Staff detail/hủy/history vẫn chưa đầy đủ. Thanh toán VNPAY bắt buộc dùng API mode. QueryDR Sandbox đã được xác minh, nhưng T08 vẫn IN_PROGRESS cho tới khi cấu hình IPN HTTPS trong portal và quan sát callback IPN thật.

## Ghi chú lịch sử: nối PaymentsModule với OrdersModule

Phần nối module dưới đây đã được hoàn thành trước lần tích hợp VNPAY và được giữ lại làm bối cảnh. Adapter thực hiện `PaymentOrderPort` tại `backend/src/payments/payment.types.ts`, tìm đơn theo cả `orderId` và `userId`, trả tổng tiền tin cậy, và áp dụng trạng thái theo state machine một cách idempotent. Cấu trúc đăng ký là:

`PaymentsModule.register({ imports: [OrdersModule], orderProvider: { provide: PAYMENT_ORDER_PORT, useExisting: OrdersService } })`.

Nếu `OrdersService` không trực tiếp khớp interface, dùng `useClass: OrdersPaymentAdapter` trong provider trên. Khóa ngoại `payments.order_id → orders.id` và đăng ký module đã có. Không thêm fallback mock vào API mode.

Callback không hợp lệ hoặc chưa xác định không được tự chuyển Order sang PAID. Replay cùng user/key/order/method phải trả Payment đã lưu và không phát hành URL/giao dịch lần hai; key dùng lại với payload khác trả 409.
