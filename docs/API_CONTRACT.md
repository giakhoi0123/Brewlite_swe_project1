# Hợp đồng API BrewLite

## ??ng b? main v?o nh?nh Orders ? 2026-10-26

Nh?p `origin/main:2c45463`: gi? h?p ??ng VNPAY m?i, Promotions/Loyalty v? gi? Zustand t? main. API staff detail, reason trim 1?300 k? t? v? `completedAt` l?u c?ng s? ki?n COMPLETED c?a TV4 ???c gi?. Ma tr?n hi?n h?nh cho ph?p h?y c? PREPARING theo c?p nh?t main; kh?ng ho?n ti?n t? ??ng. C?c ghi ch? gi?i h?n h?y tr??c ng?y n?y l? l?ch s?.

Hai nh?nh c?ng th?m `orders.cancel_reason`: migration `20261019000000_loyalty_log` d?ng `ADD COLUMN IF NOT EXISTS` ?? ch?y ti?p sau migration staff c?a TV4. Ch?a ?p migration v?o database ?ng d?ng; DB ?? ?p b?n Loyalty g?c c?n ??i chi?u l?ch s?/checksum v? c?t staff tr??c tri?n khai, kh?ng t? s?a `_prisma_migrations`. Docker daemon ch?a ch?y trong l??t ??ng b? n?y.

## VNPAY WebPay 2.1.0 / VNPAY-QR — 2026-10-21

Payment hiện được cấu hình cho VNPAY Sandbox/TEST theo luồng bất đồng bộ, không còn nhận kết quả demo từ client. Backend tạo URL có chữ ký HMAC-SHA512. `VNPAY_BANK_CODE` là cấu hình backend tùy chọn: khi để trống, request không có `vnp_BankCode` và trang hosted của VNPAY hiển thị các phương thức terminal được cấp; chỉ đặt `VNPAYQR` khi VNPAY đã bật kênh QR cho merchant TEST. `VNPAY_HASH_SECRET` chỉ tồn tại ở backend.

Ngày 2026-10-22, request ép `vnp_BankCode=VNPAYQR` ban đầu bị VNPAY trả “Ngân hàng thanh toán không được hỗ trợ”. Bộ phận kỹ thuật VNPAY sau đó xác nhận đã active VNPAYQR cho terminal TEST, nên cấu hình local hiện gửi `VNPAY_BANK_CODE=VNPAYQR`; URL ký thử đã chứa đúng bank code. Thanh toán bằng tài khoản TEST trước đó đã được QueryDR có chữ ký xác minh và lưu `PAID`; IPN vẫn là nguồn xác nhận chính và E2E callback IPN còn chờ cấu hình trong công cụ VSM Sandbox.

QR hiển thị trong Sandbox có thể báo “QR không tồn tại” khi được quét bằng ứng dụng ngân hàng LIVE vì TEST/LIVE là hai môi trường tách biệt. Kiểm thử bằng thẻ test VNPAY hoặc ứng dụng QR TEST iOS/Android do VNPAY vừa cấp qua email; việc QR xuất hiện trên hosted page không thay thế bằng chứng IPN thành công. Credential công cụ TEST là secret vận hành, không thuộc API contract và không được commit.

| Endpoint | Auth | Input | Output / hành vi |
|---|---|---|---|
| POST `/payments` | CUSTOMER | `{orderId,method:"VNPAY_QR",idempotencyKey?}` và/hoặc header `Idempotency-Key`; bắt buộc có UUID ở ít nhất một nguồn, hai nguồn phải khớp | `201 Payment` trạng thái `PROCESSING`, có `paymentUrl,expiresAt`; amount/user lấy từ Order |
| POST `/payments/:orderId/reconcile` | CUSTOMER, owner của Order | UUID `orderId`; không có body | `200 Payment`; trả trạng thái hiện có hoặc gọi QueryDR để đối soát Payment `PROCESSING` |
| GET `/payments/vnpay/ipn` | Public, chữ ký VNPAY | Query `vnp_*` | HTTP 200 JSON `{RspCode,Message}`; nguồn chốt Payment/Order chính |
| GET `/payments/vnpay/return` | Public, chữ ký VNPAY | Query `vnp_*` | Không cập nhật dữ liệu; chữ ký/reference/amount hợp lệ và mã thành công chuyển tới `/payment/:orderId/verifying`, mã không thành công tới `/payment/:orderId/unknown`, callback không hợp lệ tới `/payment/error` |

IPN phải kiểm checksum, `vnp_TmnCode`, `vnp_TxnRef` và `vnp_Amount === payment.amount * 100` trước khi ghi. Chỉ khi cả `vnp_ResponseCode` và `vnp_TransactionStatus` bằng `00` mới chuyển PAID. Chỉ lỗi cuối rõ ràng mới chuyển PAYMENT_FAILED; trạng thái chưa hoàn tất, đảo giao dịch, hoàn tiền, nghi ngờ gian lận hoặc lifecycle lạ giữ `PROCESSING` để tránh cho thanh toán lần hai khi khách có thể đã bị trừ tiền. Finalize Payment, Order state/history, inventory và loyalty chạy trong cùng transaction; Orders là owner duy nhất của phép cộng điểm, còn Payment adapter ghi `LoyaltyLog` và xóa giỏ trong transaction đó. Conditional update ngăn IPN lặp cộng điểm hoặc chuyển trạng thái lần hai. Phản hồi IPN: `00` đã cập nhật, `02` đã xử lý, `01` không tìm thấy, `04` sai số tiền, `97` sai chữ ký, `99` lỗi/chưa thể chốt.

QueryDR là fallback khi IPN bị trễ hoặc mất, không thay vai trò nguồn chính của IPN. Backend gửi request HMAC-SHA512 tới `VNPAY_QUERY_URL` bằng `VNPAY_QUERY_IP_ADDRESS`, rồi kiểm chữ ký response, `querydr`, merchant, transaction reference, amount và loại giao dịch trước khi ghi. Transaction status `00` được finalize `PAID`; `02` (lỗi), `08` (quá hạn) và `11` (hủy/hết hạn theo WebPay 2.1.0 và phản hồi Sandbox đã quan sát) được finalize `PAYMENT_FAILED`. Các trạng thái đảo giao dịch, hoàn tiền, nghi ngờ gian lận, lifecycle khác hoặc mã query lỗi giữ Payment `PROCESSING` để kiểm tra lại/thủ công. Việc finalize dùng cùng transaction/idempotency guard như IPN. Return vẫn chỉ xác minh và điều hướng, tuyệt đối không ghi DB.

Bằng chứng Sandbox/DB ngày 2026-10-22: `POST /payments/66e28a10-a95e-45ee-b877-a1617e9c3abf/reconcile` đã khôi phục giao dịch bị thiếu IPN; Payment và Order lưu `PAID`, `vnp_TransactionNo=15711511`, `vnp_BankCode=NCB`, `vnp_PayDate=20261022114118`, idempotency key `3998d99e-ff66-4ee6-a204-0a22cc35b60c`. Đây là bằng chứng QueryDR, chưa phải bằng chứng callback IPN thật.

`vnp_TxnRef` là mã chữ/số riêng cho từng Payment attempt, nên retry cùng Order vẫn có reference mới. Retry từ PAYMENT_FAILED phải giữ lại tồn kho trong cùng transaction tạo Payment trước khi phát URL. Mỗi Order chỉ có tối đa một Payment PROCESSING/PAID; PROCESSING quá hạn và UNKNOWN cần QueryDR/reconciliation trước khi cho phép attempt mới.

## Bản sửa hợp đồng trạng thái Payment — 2026-10-17

`PaymentsModule` đã được đăng ký trong `AppModule` từ main `c2d6922`. Bản sửa trên `feature/fix-payment-status` dùng chung `PaymentResultStatus = Exclude<PaymentStatus, 'PROCESSING'>` cho gateway, service, repository và `PaymentOrderPort`; factory trong AppModule khai báo rõ kiểu trả về `PaymentOrderPort`. Không có trạng thái `SUCCESS`/`FAILED` trong hợp đồng nội bộ này.

| Kết quả gateway/core | Adapter Orders | Điểm và tồn kho |
|---|---|---|
| `PAID` | Gọi state machine với `PAID`; từ PENDING hợp lệ chuyển thành PAID | Giữ kho đã reserve; áp dụng chính sách điểm hiện có `floor(total/10000)` cho chủ đơn trong cùng transaction chuyển trạng thái |
| `PAYMENT_FAILED` | Gọi state machine với `PAYMENT_FAILED`; từ PENDING chuyển thất bại | Hoàn kho theo `inventoryHeld`, không cộng điểm |
| `UNKNOWN` | Không gọi transition, giữ nguyên trạng thái/version/history | Không thay tồn kho, không cộng điểm |

Adapter kiểm tra `orderId + userId` trong transaction trước khi áp dụng mọi kết quả, kể cả UNKNOWN; không thuộc chủ đơn trả 404. HTTP lấy user từ JWT; DTO chỉ nhận `orderId,method,idempotencyKey`, các field `status,userId,amount` bị từ chối 400. Khách không có endpoint để tự đặt PAID.

Đã kiểm chứng 15 ca PostgreSQL qua AppModule thật và HTTP/JWT/DTO thật; không thay PaymentOrderPort hoặc gateway bằng port giả trong suite này. Tổng bộ test liên quan: 80/80 PASS. Chi tiết và lệnh chạy tại [PAYMENT_STATUS_VERIFICATION.md](PAYMENT_STATUS_VERIFICATION.md).

Phạm vi này chỉ sửa trạng thái và ownership. Replay vào trạng thái đã áp dụng vẫn có thể 409 theo state machine; retry PAYMENT_FAILED cần bước reserve lại; Payment.finalize và Order đang ở các transaction riêng. Chưa chốt Task 08/10B về idempotency/retry/atomicity và chưa kiểm chứng browser Payment hoặc thanh toán tiền thật. Các ghi chú cũ “chờ bật module/Orders port” phía dưới là lịch sử; các quy ước về replay là yêu cầu cần tiếp tục hoàn thiện.

Cập nhật kiểm chứng TV4 2026-10-15: Orders đã qua test HTTP + PostgreSQL thật (POST 201/PENDING, size L+topping 45.000đ, JWT cookie/Origin, history và inventory). Quan hệ Prisma nội bộ là `Order.statusHistory`; sửa service từ `history` sang `statusHistory` không thay đổi JSON API và không cần migration mới. Các ghi chú chưa kiểm chứng PostgreSQL ở mốc cũ bên dưới được thay thế bằng kết quả trong `TESTING.md`.

Base URL: `http://localhost:3001/api`. JSON; tiền là số nguyên VND. Cookie `brewlite_session` HttpOnly, SameSite=Lax; request từ browser phải dùng `credentials: include`. Lệnh ghi có cookie cần Origin đúng `FRONTEND_ORIGIN` (browser tự gửi Origin; không có CSRF token riêng). Lỗi NestJS: `{statusCode, message, error}`; `message` có thể là chuỗi hoặc mảng. Orders/Inventory và migration Auth đã có bằng chứng PostgreSQL trước đó. Payments đã nối Orders trong mã; test PostgreSQL Payment mới còn chờ URL DB test.

## Endpoint chính thức

| Chủ sở hữu | Method và đường dẫn | Auth | Request DTO | Success response | Lỗi | Màn hình | Trạng thái |
|---|---|---|---|---|---|---|---|
| TV2 | GET `/products` | Không | Không | `ProductListItem[]` | 500 DB | Menu | Backend + PostgreSQL HTTP đã xác minh |
| TV2 | GET `/products/:id` | Không | UUID path | `ProductDetail` | 400 UUID, 404, 500 | Chi tiết | Backend + PostgreSQL HTTP đã xác minh |
| TV1 | POST `/auth/register` | Không | `{name,email,password}` | `{user}` và cookie | 400, 409 | Đăng ký | Backend + PostgreSQL HTTP đã xác minh |
| TV1 | POST `/auth/login` | Không | `{email,password}` | `{user}` và cookie | 400, 401 | Đăng nhập | Backend + PostgreSQL HTTP đã xác minh |
| TV4 | POST `/orders` | CUSTOMER | `{items:[{productId,size,toppingIds,quantity,ice,sugar,note?}],promotionCode?}` (`note` ≤ 120 ký tự, ghi chú cho Barista) | `Order` PENDING | 400, 401, 403, 409, 422 | Checkout | Backend + PostgreSQL tests sau merge qua; browser API E2E chưa chạy |
| TV5 | POST `/payments` | CUSTOMER | `{orderId,method:"VNPAY_QR",idempotencyKey?}` và/hoặc `Idempotency-Key` header | `Payment` PROCESSING + `paymentUrl,expiresAt` | 400, 401, 404, 409, 503 | Khởi tạo VNPAY-QR | Không nhận amount/status/demoOutcome từ client; header/body key không khớp trả 400 |
| TV5 | POST `/payments/:orderId/reconcile` | CUSTOMER | UUID path, không body | Payment mới nhất; QueryDR có thể finalize `PAID`/`PAYMENT_FAILED` | 400, 401, 403, 404, 503 | Verifying / kiểm tra trạng thái | Kiểm tra ownership và response VNPAY có chữ ký; fallback khi IPN trễ/mất |
| TV4+TV6 | GET `/orders/me` | CUSTOMER | Không | `Order[]` | 401, 403, 500 | Đơn của tôi | Backend; chỉ đơn của người đăng nhập, mới nhất trước |

### Giỏ hàng theo tài khoản (TV3, backend còn nhưng frontend không dùng)
Từ 2026-10-24 frontend quay về giỏ Zustand (localStorage) và gửi items trong body `POST /orders`; không gọi các route dưới đây. Giữ lại để tránh sửa phần Orders/Payment đang tham chiếu `cart-pricing.ts` và bảng `cart_items`.

Mọi route cần đăng nhập (cookie hoặc Bearer); 401 nếu chưa đăng nhập. Mỗi route trả `CartView`. Giá **không** lưu trong giỏ: server luôn tính lại `unitPrice = price + size.extraPrice + Σ topping.extraPrice` từ Product hiện tại; client gửi giá sẽ bị 400.

| Method và đường dẫn | Request | Thành công | Lỗi |
|---|---|---|---|
| GET `/cart` | Không | 200 `CartView` (giỏ trống nếu chưa có) | 401 |
| POST `/cart/items` | `{productId,size,toppingIds,quantity,ice,sugar,note?}` | 201 `CartView`; trùng cấu hình thì cộng số lượng (tối đa 99) | 400 validate, 404 sản phẩm, 409 vượt tồn kho, 422 size/topping không hợp lệ hoặc tạm hết |
| PATCH `/cart/items/:id` | `{quantity?, size?}` (ít nhất một) | 200 `CartView`; đổi size trùng dòng khác thì gộp | 400, 404 (không phải giỏ của mình), 409, 422 |
| DELETE `/cart/items/:id` | Không | 200 `CartView` | 400 UUID, 404 |
| DELETE `/cart` | Không | 200 `CartView` trống | 401 |
| POST `/cart/merge` | `{items:[CartLine…]}` (≤ 50) | 200 `CartView & {skipped:[{productId,reason}]}`; dòng lỗi bị bỏ qua | 400 |

`ice` ∈ `100% đá | 70% đá | 30% đá | Không đá`; `sugar` ∈ `100% chuẩn | 70% ngọt vừa | 50% ít ngọt | Không đường`; `note` ≤ 120 ký tự; `quantity` 1–99. Tồn kho được kiểm tra trên tổng số lượng mọi dòng cùng món; chỉ chặn khi tăng, giảm luôn được phép. Nếu tồn kho/tùy chọn thay đổi sau khi thêm, dòng vẫn trả về với `available:false` và `issue`, `valid` của giỏ là `false`.

`CartView` = `{"items":[{"id":"uuid","productId":"uuid","name":"Bạc xỉu","imageUrl":"/...","size":"M","sizeName":"Vừa (M)","sizeOptions":[{"code":"S","name":"Nhỏ","extraPrice":0,"available":true}],"toppingIds":["uuid"],"toppingNames":["Kem sữa"],"ice":"70% đá","sugar":"50% ít ngọt","note":"","quantity":2,"unitPrice":40000,"lineTotal":80000,"available":true}],"totalQuantity":2,"subtotal":80000,"valid":true}`.

### Ví dụ Products
`GET /products` → `[{"id":"uuid","name":"Bạc xỉu","price":29000,"imageUrl":"/images/products/sample-milk-coffee.svg","stock":40,"description":"..."}]`.
`GET /products/uuid` → `{"id":"uuid","name":"Bạc xỉu","price":29000,"stock":40,"description":"...","imageUrl":"/...svg","sizes":[{"id":"uuid","code":"S","name":"Nhỏ","extraPrice":0,"available":true}],"toppings":[{"id":"uuid","name":"Kem sữa","extraPrice":6000,"available":true}],"defaultSizeId":"uuid"}`. Backend trả đủ S/M/L.

### Ví dụ Auth
`POST /auth/register` body `{"name":"An","email":"an@example.test","password":"Password123"}` → `201 {"user":{"id":"uuid","email":"an@example.test","name":"An","role":"CUSTOMER","loyaltyPoints":0}}`; header Set-Cookie. Role gửi từ client bị từ chối 400. Email trùng 409. `POST /auth/login` body `{"email":"an@example.test","password":"Password123"}` → cùng user/cookie; sai mật khẩu 401. Không trả JWT trong JSON.

### Ví dụ Orders và Payments
`POST /orders` body `{"items":[{"productId":"uuid","size":"M","toppingIds":[],"quantity":2,"ice":"70% đá","sugar":"50% ít ngọt"}]}` → `201 {"id":"uuid","userId":"uuid","items":[...],"subtotal":98000,"discount":0,"total":98000,"status":"PENDING","createdAt":"2026-10-14T00:00:00Z"}`. `POST /payments` body `{"orderId":"uuid","method":"VNPAY_QR","idempotencyKey":"uuid"}` → `201 {"id":"uuid","orderId":"uuid","method":"VNPAY_QR","status":"PROCESSING","idempotencyKey":"uuid","paymentUrl":"https://...","expiresAt":"..."}`. `GET /orders/me` → mảng Order cùng cấu trúc. Backend phải tính giá lại, kiểm tra tồn kho và sở hữu đơn.

Order đã thanh toán trả thêm `paymentMethod:"WALLET"|"CARD"|"VNPAY_QR"`, lấy từ Payment `PAID` mới nhất của order. Màn kết quả phải dùng trường này để hiển thị đúng phương thức kể cả sau khi tải lại trang; không suy đoán từ query Return hoặc payment intent đã xóa.

### Quy ước Payment đã chốt
- `idempotencyKey` là UUID và duy nhất theo user. Cùng user + key + order + method trả lại Payment/URL đã lưu, không tạo VNPAY transaction lần hai.
- Dùng lại key với order hoặc method khác trả `409`. Một Order có Payment PROCESSING/PAID khác cũng trả `409`, không phát URL thứ hai.
- `PROCESSING` là response hợp lệ của API khởi tạo, không có nghĩa đã thanh toán. Frontend chuyển tới `paymentUrl`; sau Return gọi reconcile một lần rồi chỉ đọc trạng thái Order đã được IPN hoặc QueryDR xác nhận. Nút “Kiểm tra trạng thái đơn” thực hiện lại cùng trình tự.
- Return có mã không thành công không finalize Payment và không đổi Order. Màn `/payment/:orderId/unknown` cho phép quay lại `/checkout?resumeOrder=<orderId>`; frontend dùng lại payment intent và `idempotencyKey` cũ để replay Payment `PROCESSING`, nên backend trả lại attempt/URL hiện có thay vì tạo Order hoặc Payment mới.
- Backend lấy `amount` từ Order của user, không nhận giá hoặc `userId` từ request. `404` dùng khi không tìm thấy đơn thuộc user; order ngoài `PENDING/PAYMENT_FAILED` trả `409`.
- `PaymentsModule.register(...)` import OrdersModule và provider `PAYMENT_ORDER_PORT`. Migration `20261017000000_payment_order_fk` thêm khóa ngoại `payments.order_id → orders.id`.
- PAID/PAYMENT_FAILED chỉ do IPN hợp lệ hoặc response QueryDR đã kiểm chữ ký finalize cùng transaction với Order transition, status history, tồn kho và điểm; lỗi ở bất kỳ bước nào rollback toàn bộ ghi DB. Return URL không ghi DB.
- Replay callback hoặc cùng idempotency key không chuyển Order/cộng điểm lần hai. Retry từ PAYMENT_FAILED giữ kho lại trước khi phát URL VNPAY; nếu không đủ kho thì rollback và không tạo attempt.
- Chỉ khi IPN hoặc QueryDR hợp lệ đã finalize `PAYMENT_FAILED`, nút “Thử thanh toán lại” mới quay về `/checkout?retryOrder=<orderId>`, dùng snapshot/tổng của cùng Order và `idempotencyKey` mới để tạo Payment VNPAY attempt mới; không gọi lại `POST /orders`.

## Endpoint bổ sung đề xuất, chưa thuộc 7 endpoint chính thức
- GET `/auth/me`: TV1, JWT bắt buộc, trả `{user}`; 401 khi hết hạn. Đã triển khai.
- POST `/auth/logout`: TV1, cần JWT hợp lệ; tăng `users.session_version` rồi xóa cookie. JWT cũ trả 401 ngay sau đó. Đã kiểm tra với PostgreSQL QA.
- GET `/orders/:id`: TV4, CUSTOMER, trả `Order` cùng cấu trúc POST; 404 nếu không tồn tại hoặc không thuộc người đăng nhập, 400 nếu UUID sai. Đã có backend.
- GET `/orders/:id/status`: TV4, cùng auth/ownership; trả JSON `{ "status": "PENDING" }`. REST adapter unwrap thành `OrderStatus` theo interface frontend. Đã có backend.
- POST `/promotions/validate`: TV6, `{code,subtotal}` → `{code,discount}`.
- GET `/loyalty/me`: TV6, `{points}`.
- GET `/staff/orders`: TV4, BARISTA, `Order[]` trạng thái PAID/PREPARING/READY/COMPLETED/CANCELLED, sắp xếp `createdAt ASC, id ASC`. Đã có backend; frontend lọc queue và lịch sử từ cùng danh sách.
- PATCH `/staff/orders/:id/status`: TV4, BARISTA, `{status:"PREPARING"|"READY"|"COMPLETED"}` → `Order`; 400 payload/UUID sai, 401/403 auth/Origin, 404 không tồn tại, 409 chuyển trạng thái sai hoặc xung đột. Không cho staff đặt PAID/PENDING/PAYMENT_FAILED/CANCELLED qua endpoint này.
- GET `/staff/orders/:id`: TV4, chỉ BARISTA; trả chi tiết `Order` ở mọi trạng thái; 400 UUID sai, 404 không tồn tại.
- PATCH `/staff/orders/:id/cancel`: TV4, chỉ BARISTA, `{reason:string}` bắt buộc 1–300 ký tự sau trim; 400 payload/UUID sai, 401/403 auth/Origin, 404 không tồn tại, 409 sai trạng thái hoặc xung đột. Trả `Order` CANCELLED và lý do đã lưu.
- GET `/barista/dashboard`: TV1, endpoint mẫu kiểm tra guard BARISTA; đã triển khai, không phải Orders API.

## Kiểu chung
Xem `frontend/src/types/domain.ts`: `User`, `Role`, `Product`, `ProductSize`, `Topping`, `CartItem`, `Order`, `OrderItem` (item trong `Order.items`), `Payment`, `Promotion`, `LoyaltyPoints`, `OrderStatus`. Trạng thái: `PENDING → PAID → PREPARING → READY → COMPLETED`; nhánh `PAYMENT_FAILED`, retry về PENDING, `CANCELLED` từ PENDING/PAID/PAYMENT_FAILED. COMPLETED/CANCELLED kết thúc. Không cho hủy PREPARING nếu chưa thống nhất extension.

## Quy tắc chờ thống nhất
- Chênh lệch giá S/M/L, topping: backend Product API là nguồn chuẩn; mock có giá minh họa riêng.
- Eligibility ưu đãi và trần giảm: demo chỉ nhận `BREW10`, giảm tối đa 10.000 VND; không phải chính sách thật.
- Tỷ lệ tích điểm/đổi điểm: demo `floor(total/10000)` sau PAID; TV6 định nghĩa thật.
- Reservation/release tồn kho và race condition: theo quy tắc TV4 bên dưới.
- Payment retry/idempotency: TV5 xác định thời hạn khóa và semantics của trạng thái UNKNOWN. Payment retention/cleanup và thời hạn coi bản ghi `PROCESSING` là treo vẫn cần nhóm thống nhất; quy tắc replay và `UNKNOWN` đã chốt ở trên.
- Barista cancellation khi PREPARING: chưa được phép trong UI demo.

## Hợp đồng Staff Orders — backend TV4 mở rộng 2026-10-16

| Endpoint | Input | Output cần có | Kiểm tra server |
|---|---|---|---|
| GET `/staff/orders` | Cookie/JWT BARISTA | `Order[]` PAID/PREPARING/READY/COMPLETED/CANCELLED | 401 thiếu phiên, 403 CUSTOMER; không đưa PENDING/PAYMENT_FAILED vào queue |
| GET `/staff/orders/:id` | UUID đường dẫn | `Order` ở mọi trạng thái hoặc 404 | Chỉ BARISTA; 400 UUID sai, 404 không tồn tại |
| PATCH `/staff/orders/:id/status` | `{status: "PREPARING"|"READY"|"COMPLETED"}` | `Order` mới nhất | Đã có backend; sai bước 409, transaction chống race |
| PATCH `/staff/orders/:id/cancel` | `{reason: string}` (1–300 ký tự sau trim) | `Order` với `status:"CANCELLED",cancelReason` | Chỉ từ PENDING/PAID/PAYMENT_FAILED; 409 sai bước/race/lặp; PATCH status=CANCELLED trả 400 |

`Order` trả `id,userId,items,subtotal,discount,total,status,createdAt,customerName`; `customerName` là tên hiện tại của chủ đơn. `cancelReason` và `completedAt` chỉ xuất hiện khi có giá trị trong DB (không trả null). `completedAt` là ISO UTC tại lần chuyển READY → COMPLETED, cùng thời điểm sự kiện lịch sử, không phải thời điểm đặt đơn. Cả API staff và API khách trả các trường mở rộng này; khách chỉ đọc đơn của chính mình. Không trả user relation, email, password hash hay thông tin phiên. Item giữ nguyên snapshot `quantity,name,size,toppingNames,ice,sugar,note,unitPrice`.

Migration `20261016000100_staff_order_details` thêm `orders.cancel_reason` (VARCHAR 300, nullable) và `orders.completed_at` (nullable). Đơn COMPLETED cũ được lấy thời điểm từ sự kiện COMPLETED có sẵn trong `order_status_history`; không có sự kiện thì giữ null. Đơn CANCELLED cũ không được tự tạo lý do giả. Không sửa migration đã áp dụng.

Hủy lưu reason, tăng version, chuyển trạng thái, hoàn kho nếu còn giữ và ghi lịch sử trong cùng transaction. Hủy lặp hoặc thua race trả 409, không đổi reason và không hoàn kho lần hai. PREPARING/READY/COMPLETED không được hủy. Hủy PAID không đồng nghĩa hoàn tiền: tích hợp hoàn tiền vẫn thuộc TV5 và chưa có. Hàm nội bộ `transitionInTransaction(tx,id,'CANCELLED',reason)` cũng bắt buộc reason; các transition khác giữ nguyên chữ ký 3 tham số.

Danh sách hiện chưa phân trang; dùng cho quy mô demo hiện tại, UI lọc PAID cho hàng chờ và COMPLETED/CANCELLED cho lịch sử. TV1 cần bật các nhánh API mode đang ẩn history/KPI/nút hủy trong `barista-board.tsx`, sau đó chạy browser E2E; backend hoàn tất không tự bật các nhánh giao diện này.

Auth response register/login/me/logout đặt `Cache-Control: no-store`. Cookie `brewlite_session` được ký JWT với `sessionVersion`; phiên cũ 401 sau logout. Migration `20261016000000_session_version` chỉ thêm cột mặc định 0, không xóa dữ liệu.
## Orders/Inventory TV4 — contract triển khai 2026-10-15

- `items` bắt buộc có 1–100 dòng; `productId` UUID; `size` S/M/L; `toppingIds` mảng UUID không trùng, tối đa 30; `quantity` số nguyên 1–99; `ice`/`sugar` chuỗi 1–40 ký tự; `note` tùy chọn tối đa 120; `promotionCode` tùy chọn 1–64 ký tự và không chỉ có khoảng trắng. Các field lạ như `price`, `unitPrice`, `total`, `userId`, `discount` bị từ chối 400. Tồn kho là theo Product, không theo size/topping.
- Product phải tồn tại; size và quan hệ ProductTopping phải thuộc đúng sản phẩm và `available=true`. Product hiện không có cờ available riêng; stock=0 chặn đặt hàng. Sai cấu hình trả 400; thiếu kho/xung đột version trả 409. Giá VND được tính lại: `unitPrice=Product.price+ProductSize.extraPrice+sum(ProductTopping.extraPrice)`, `lineTotal=unitPrice*quantity`, `subtotal=sum(lineTotal)`, `total=subtotal-discountAmount`. Giá/tổng không vượt Int PostgreSQL.
- DB lưu `qty`, `discountAmount`; response dùng `quantity`, `discount` theo frontend. `Order.items` có `key` là UUID dòng đơn, `productId`, `name`, `imageUrl`, `size`, `toppingIds`, `toppingNames`, `unitPrice`, `quantity`, `lineTotal`, `ice`, `sugar`, `note?`. Tên/ảnh/giá gốc/giá size/tên và giá topping được chụp tại lúc đặt, không đọc giá hiện tại khi xem lịch sử.
- Tạo PENDING, giữ kho, ghi items và history trong **cùng transaction**. Gộp số lượng mọi dòng cùng product trước khi giữ kho; cập nhật theo thứ tự product ID với `WHERE id AND version AND stock>=qty`, giảm stock và tăng version. Count=0 làm toàn bộ transaction rollback, không tự retry POST.
- Khi sang PAYMENT_FAILED hoặc CANCELLED, hoàn kho nếu `inventoryHeld=true`; đổi cờ thành false cùng transaction. Hủy PAYMENT_FAILED không hoàn lần hai. Retry chỉ `PAYMENT_FAILED -> PENDING`, phải giữ kho lại; nếu hết kho, rollback và giữ PAYMENT_FAILED. Giữ nguyên giá snapshot khi retry. PAID/PREPARING/READY/COMPLETED không trừ thêm; COMPLETED không hoàn kho. UNKNOWN là kết quả payment, không phải trạng thái Order và không giải phóng kho.
- Mọi transition dùng state machine và CAS theo cả `Order.status` + `Order.version`; version ngăn xung đột cả khi trạng thái đã đi qua vòng retry rồi quay lại. Ghi `OrderStatusHistory` với from/to, version và thời điểm trong cùng transaction. Lặp transition cũng trả 409; TV5 cần xử lý idempotency trước khi gọi transition.
- Chưa có TTL tự hủy đơn PENDING; stock được giữ đến khi thanh toán thất bại/hủy. POST /orders chưa có idempotency server; nếu mất response sau commit, cần kiểm tra `/orders/me` trước khi gửi lại. Hủy PAID chỉ xử lý đơn/kho; chính sách hoàn tiền và đảo điểm thuộc TV5/TV6, chưa có trong phần này.

### Điểm tích hợp TV5 / TV6

`OrdersModule` export `OrdersService`. TV5 gọi `transitionInTransaction(tx, orderId, targetStatus)` bằng **Prisma.TransactionClient của transaction đang ghi payment/idempotency/loyalty**, truyền lỗi ra ngoài để rollback toàn bộ. TV5 phải xác minh ownership, payment result và idempotency; không gọi trực tiếp update status/stock. Retry phải giữ kho lại thành PENDING trước khi bắt đầu lần thanh toán mới; không giữ DB transaction mở trong khi gọi gateway. UNKNOWN không gọi transition. Không expose hàm này thành endpoint cho khách tự xác nhận PAID. TV6 có thể ghi điểm bằng cùng tx sau khi transition PAID thành công, với uniqueness/idempotency riêng.

`ORDER_DISCOUNT` là injection token cho interface `OrderDiscount.calculate(tx,{userId,subtotal,promotionCode?}): Promise<number>`. TV6 thay provider `NoPromotionDiscount` trong OrdersModule bằng implementation tính/giữ lượt dùng ưu đãi trong cùng tx. Giá trị giảm phải là số nguyên từ 0 đến subtotal. Hiện không có mã → giảm 0; có mã → 422, **không** áp dụng mã demo BREW10 trên backend.

Các writer tồn kho khác (TV2) phải tăng Product.version mỗi lần đổi stock; thay đổi catalog liên quan khi đang nhận đơn cần thống nhất cùng cơ chế version. Không gọi InventoryService.restore độc lập với CAS Order, tránh hoàn kho nhiều lần. Migration mới: `20261015000100_orders_inventory`; có FK, index và CHECK giá/số lượng/version, được tạo bằng Prisma diff offline, chưa apply lên DB tại phiên này.


## L?ch s? ri?ng nh?nh TV4 tr??c khi nh?p main ng?y 2026-10-26

C?c b?ng ch?ng d??i ??y thu?c code v? gateway mock ? th?i ?i?m ghi nh?n, kh?ng x?c nh?n phi?n b?n VNPAY hi?n t?i.

## TV4 kiểm chứng hợp đồng — 2026-10-18

Không thay JSON/endpoint trong lượt đối chiếu báo cáo `(2).docx`. Staff list/detail/cancel/status, `cancelReason?`, `completedAt?` bên dưới đã được kiểm chứng cùng Orders/Inventory: 272 backend tests PASS và browser hai phiên API thật tại 1440/768/390. List vẫn gồm PAID/PREPARING/READY/COMPLETED/CANCELLED; UI lọc PAID cho hàng chờ và terminal cho history. Hủy chỉ PENDING/PAID/PAYMENT_FAILED, không phải refund. UI API mode hủy/history/KPI còn do TV1 bật. [Bằng chứng TV4](TV4_ACCEPTANCE.md).
