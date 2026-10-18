# Hợp đồng API BrewLite

## Task 06 review — 2026-10-17, mới nhất

Kiểm chứng lại trên code `2c8adc2` sau khi nhập main `bacb7a6`, PR #16 chưa merge: toàn bộ backend 247/247 trên PostgreSQL thật (10 migration, 0 skipped); browser Orders API 4/4 tại 1440/768/390. Hợp đồng Task 06 giữ nguyên: POST 201 với UUID/PENDING, giá server, snapshot/history/reserve cùng transaction, giỏ chưa xóa và chưa cấp điểm/Payment. Browser chặn request Payment bằng route.abort, không giả kết quả thanh toán. Chi tiết [TASK06_REVIEW_VERIFICATION.md](TASK06_REVIEW_VERIFICATION.md). Phần Task 06 ngày 16 dưới là bằng chứng cũ; Payment/Promotion/Staff được bảo toàn từ main.

## Task 06 — cập nhật 2026-10-16

`POST /orders` đã kiểm chứng trên PostgreSQL 15 và trình duyệt API mode (1440/768/390): HTTP 201, UUID mã đơn, PENDING, giá server và snapshot/history/kho lưu cùng transaction. Xem [TASK06_VERIFICATION.md](TASK06_VERIFICATION.md).

- `productId` và mỗi `toppingIds` được chuẩn hóa chữ thường trước lookup; topping trùng khác hoa/thường bị 400.
- `ice` chỉ nhận `100% đá | 70% đá | 30% đá | Không đá`; `sugar` chỉ nhận `100% chuẩn | 70% ngọt vừa | 50% ít ngọt | Không đường`, dùng cùng danh sách Cart. Không còn nhận chuỗi bất kỳ 1–40 ký tự.
- Giá/owner/status client tự gửi bị 400; cấu hình hoặc mã ưu đãi không hợp lệ trả 400 với provider PromotionDiscount trên main mới; thiếu kho/xung đột 409. Không cần migration cho thay đổi DTO này.
- Tạo PENDING giữ nguyên Cart, không tự tạo Payment/cộng điểm. Browser test cô lập request Payment của Task 08, không suy ra thanh toán đã hoàn thành.
- Main `c2d6922` đã đăng ký PaymentsModule và provider PromotionDiscount; trạng thái Payment/Promotion cũ bên dưới cần được owner cập nhật/kiểm chứng riêng.

## Payment consistency — 2026-10-17, trạng thái mới nhất

Đã tích hợp `origin/main:808077f` (PR #15/#17) trong lượt này. Giữ FK Payment→Order, trường paymentMethod và sandbox `demoOutcome` của main: chỉ gateway có `PAYMENT_DEMO_CONTROLS=true` sử dụng lựa chọn demo; replay cùng key luôn trả kết quả cũ dù client thay lựa chọn demo. `prepareAttempt` dùng lại `OrdersService.preparePaymentRetry` khi cần reserve, không nhân bản state machine.

HTTP DTO/response không đổi. Bản sửa trạng thái `b6ca9ac` đã có trong nhánh nền `feature/fix-payment-status` trước lượt này; giữ nhánh hiện có; mở PR #18 sau khi PR #15 đã merge, không trộn Task 06 hoặc Loyalty mới.

- Một user + idempotency key + order + method trả đúng Payment đã hoàn tất, kể cả đơn đã chuyển tiếp ở Barista; không gọi gateway, transition hoặc cấp điểm lại. Key đổi order/method trả 409; đơn không thuộc user trả 404.
- PostgreSQL khóa hàng Order khi claim/settle. Unique `(user_id,idempotency_key)` và partial unique index trên `order_id` cho PROCESSING/UNKNOWN/PAID bảo vệ cả request khác key/instance. Request đang xử lý trả 409; client phải giữ key cũ, không tạo key mới để vượt khóa.
- Retry chỉ sau PAYMENT_FAILED bằng **key mới**. Trong cùng transaction, `prepareAttempt` kiểm tra ownership, chuyển PAYMENT_FAILED → PENDING và reserve kho lại, rồi tạo Payment PROCESSING. Thiếu kho/xung đột trả 409 và rollback cả claim/kho/history; gateway chưa được gọi. Giá lấy snapshot Order, không lấy giá catalog mới.
- Sau commit claim, gọi gateway **ngoài DB transaction**. Provider nhận `idempotencyKey = Payment.id` cố định theo attempt. Đây không phải cam kết rằng gateway hiện tại đã tích hợp ngân hàng thật.
- Lưu `gatewayStatus` bền vững trước khi settle. Một transaction tiếp theo dùng chung `Prisma.TransactionClient` để áp dụng Order/kho/history/điểm và finalize Payment với `appliedAt`. Nếu transaction này lỗi, cùng key replay sẽ phục hồi từ journal, không gọi gateway lại. Hai instance tranh settle sẽ chỉ áp dụng một lần nhờ khóa Order.
- UNKNOWN hoặc exception/timeout của gateway không tự thành PAID, không cộng điểm, giữ Order PENDING và kho đã reserve. Cùng key trả UNKNOWN, mọi key mới cho đơn này bị 409 cho đến khi đối soát xác định kết quả.
- PROCESSING chưa có journal (crash trước/sau gateway hoặc lỗi lưu journal) không tự hết hạn và không được charge lại. Chưa có API đối soát tự động; cần tra cứu kết quả tại provider và quy trình vận hành riêng. Không suy đoán thành công/thất bại từ thời gian chờ.

Migration `20261017000000_payment_consistency` thêm gateway_status/applied_at, CHECK và partial unique index trong transaction. Không gán điểm/timestamp giả cho bản ghi cũ. Nếu có nhiều live attempts cùng đơn, migration từ chối và rollback; phải audit/đối soát dữ liệu cũ trước deploy, không xóa Payment để ép migration qua. Replay final rows cũ trả kết quả cũ, không tự sửa các sai lệch Order/điểm từ trước.

Kiểm chứng: 9 suites/111 tests PASS, 0 skipped; 40 ca PostgreSQL gồm 20 consistency, 2 migration, 15 status và 3 integration/FK. Hai AppModule độc lập, chỉ gateway bên ngoài được điều khiển trong test consistency; Auth/Prisma/Orders/Inventory/Payment adapter thật. Chi tiết: [PAYMENT_CONSISTENCY_VERIFICATION.md](PAYMENT_CONSISTENCY_VERIFICATION.md). Các đoạn bên dưới là mốc trước khi hoàn thiện consistency.

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
| TV4 | POST `/orders` | CUSTOMER | `{items:[{productId,size,toppingIds,quantity,ice,sugar,note?}],promotionCode?}` (`note` ≤ 120 ký tự) | `Order` PENDING, UUID mã đơn | 400, 401, 403, 409 | Checkout | PostgreSQL 15 và browser API 1440/768/390 PASS, xem TASK06_VERIFICATION |
| TV5 | POST `/payments` | JWT, chủ đơn | `{orderId,method,idempotencyKey}` | `Payment` PAID/PAYMENT_FAILED/UNKNOWN | 400, 401, 404, 409 | Xử lý/kết quả | Đã đăng ký AppModule; status/consistency qua PostgreSQL, browser E2E còn chờ |
| TV4+TV6 | GET `/orders/me` | CUSTOMER | Không | `Order[]` | 401, 403, 500 | Đơn của tôi | Backend; chỉ đơn của người đăng nhập, mới nhất trước |

### Giỏ hàng theo tài khoản (TV3, đã triển khai)
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
`POST /orders` body `{"items":[{"productId":"uuid","size":"M","toppingIds":[],"quantity":2,"ice":"70% đá","sugar":"50% ít ngọt"}]}` → `201 {"id":"uuid","userId":"uuid","items":[...],"subtotal":98000,"discount":0,"total":98000,"status":"PENDING","createdAt":"2026-10-14T00:00:00Z"}`. `POST /payments` body `{"orderId":"uuid","method":"WALLET","idempotencyKey":"uuid"}` → `201 {"id":"uuid","orderId":"uuid","method":"WALLET","status":"PAID","idempotencyKey":"uuid"}`. Lỗi gateway được trả bằng `PAYMENT_FAILED`, timeout/chưa chắc chắn là `UNKNOWN`. Trong sandbox có thể gửi thêm `demoOutcome:"PAID"|"PAYMENT_FAILED"|"UNKNOWN"`; backend chỉ sử dụng field này khi `PAYMENT_DEMO_CONTROLS=true`, ngoài sandbox sẽ bỏ qua. `GET /orders/me` → mảng Order cùng cấu trúc. Backend phải tính giá lại, kiểm tra tồn kho và sở hữu đơn.

Order đã thanh toán trả thêm `paymentMethod:"WALLET"|"CARD"`, lấy từ Payment `PAID` mới nhất của order. Màn kết quả phải dùng trường này để hiển thị đúng phương thức kể cả sau khi tải lại trang; không suy đoán từ trạng thái UI hoặc payment intent đã xóa.

### Quy ước Payment đã chốt
- `idempotencyKey` là UUID và duy nhất theo user. Cùng user + key + order + method trả lại Payment đã lưu, không gọi gateway lần hai.
- Dùng lại key với order hoặc method khác trả `409`. Request trùng khi bản ghi nội bộ còn `PROCESSING` cũng trả `409` để client kiểm tra lại, không tự phát lệnh mới.
- `PROCESSING` là trạng thái nội bộ trong database, không phải success response của API. Gateway ném lỗi/timeout được chốt thành `UNKNOWN`; Order port phải giữ trạng thái hiện tại và cho phép truy vấn xác minh.
- Backend lấy `amount` từ Order của user, không nhận giá hoặc `userId` từ request. `404` dùng khi không tìm thấy đơn thuộc user; order ngoài `PENDING/PAYMENT_FAILED` trả `409`.
- `PaymentsModule.register(...)` import OrdersModule và provider `PAYMENT_ORDER_PORT`. Migration `20261017000000_payment_order_fk` thêm khóa ngoại `payments.order_id → orders.id`.
- Kết quả PAID/PAYMENT_FAILED được finalize cùng transaction với Order transition, status history, tồn kho và điểm; lỗi ở bất kỳ bước nào rollback toàn bộ ghi DB. UNKNOWN chỉ finalize Payment, không đổi Order.
- Replay cùng key đã hoàn tất chỉ trả Payment đã lưu, không chuyển Order lần hai và không cộng điểm lần hai. Retry từ PAYMENT_FAILED không đổi Order trước khi gọi gateway: nếu kết quả PAID, hệ thống giữ lại tồn kho, chuyển qua PENDING rồi PAID trong cùng transaction finalize; nếu tiếp tục PAYMENT_FAILED hoặc UNKNOWN, Order và tồn kho giữ nguyên trạng thái thất bại. Không giữ transaction DB mở trong lúc gọi gateway.
- Trên frontend, nút “Thử thanh toán lại” từ màn thất bại quay về `/checkout?retryOrder=<orderId>`. Checkout phải tải và xác minh đúng Order của user có trạng thái `PAYMENT_FAILED`, hiển thị snapshot/tổng tiền của đơn cũ, cho chọn lại phương thức/kịch bản gateway rồi tạo payment intent mới cho **cùng orderId**; không gọi lại `POST /orders`.
- Mock gateway mặc định trả `PAID`; môi trường test có thể đặt `MOCK_PAYMENT_OUTCOME=PAID|PAYMENT_FAILED|UNKNOWN`.

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
