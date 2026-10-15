# Hợp đồng API BrewLite

Cập nhật kiểm chứng TV4 2026-10-15: Orders đã qua test HTTP + PostgreSQL thật (POST 201/PENDING, size L+topping 45.000đ, JWT cookie/Origin, history và inventory). Quan hệ Prisma nội bộ là `Order.statusHistory`; sửa service từ `history` sang `statusHistory` không thay đổi JSON API và không cần migration mới. Các ghi chú chưa kiểm chứng PostgreSQL ở mốc cũ bên dưới được thay thế bằng kết quả trong `TESTING.md`.

Base URL: `http://localhost:3001/api`. JSON; tiền là số nguyên VND. Cookie `brewlite_session` HttpOnly, SameSite=Lax; request từ browser phải dùng `credentials: include`. Lệnh ghi có cookie cần Origin đúng `FRONTEND_ORIGIN` (browser tự gửi Origin; không có CSRF token riêng). Lỗi NestJS: `{statusCode, message, error}`; `message` có thể là chuỗi hoặc mảng. Orders/Inventory và migration Auth mới đã chạy chung trên PostgreSQL kiểm thử riêng sau merge: 168/168 tests. Payments vẫn chờ TV5.

## Endpoint chính thức

| Chủ sở hữu | Method và đường dẫn | Auth | Request DTO | Success response | Lỗi | Màn hình | Trạng thái |
|---|---|---|---|---|---|---|---|
| TV2 | GET `/products` | Không | Không | `ProductListItem[]` | 500 DB | Menu | Backend + PostgreSQL HTTP đã xác minh |
| TV2 | GET `/products/:id` | Không | UUID path | `ProductDetail` | 400 UUID, 404, 500 | Chi tiết | Backend + PostgreSQL HTTP đã xác minh |
| TV1 | POST `/auth/register` | Không | `{name,email,password}` | `{user}` và cookie | 400, 409 | Đăng ký | Backend + PostgreSQL HTTP đã xác minh |
| TV1 | POST `/auth/login` | Không | `{email,password}` | `{user}` và cookie | 400, 401 | Đăng nhập | Backend + PostgreSQL HTTP đã xác minh |
| TV4 | POST `/orders` | CUSTOMER | `{items:[{productId,size,toppingIds,quantity,ice,sugar,note?}],promotionCode?}` (`note` ≤ 120 ký tự, ghi chú cho Barista) | `Order` PENDING | 400, 401, 403, 409, 422 | Checkout | Backend + PostgreSQL tests sau merge qua; browser API E2E chưa chạy |
| TV5 | POST `/payments` | CUSTOMER | `{orderId,method,idempotencyKey}` | `Payment` PAID/PAYMENT_FAILED/UNKNOWN | 400, 401, 404, 409 | Xử lý/kết quả | Core/controller/schema có; chờ Orders port để bật module |
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

### Ví dụ Orders và Payments (Payments chờ TV5)
`POST /orders` body `{"items":[{"productId":"uuid","size":"M","toppingIds":[],"quantity":2,"ice":"70% đá","sugar":"50% ít ngọt"}]}` → `201 {"id":"uuid","userId":"uuid","items":[...],"subtotal":98000,"discount":0,"total":98000,"status":"PENDING","createdAt":"2026-10-14T00:00:00Z"}`. `POST /payments` body `{"orderId":"uuid","method":"WALLET","idempotencyKey":"uuid"}` → `201 {"id":"uuid","orderId":"uuid","method":"WALLET","status":"PAID","idempotencyKey":"uuid"}`. Lỗi gateway được trả bằng `PAYMENT_FAILED`, timeout/chưa chắc chắn là `UNKNOWN`. `GET /orders/me` → mảng Order cùng cấu trúc. Backend phải tính giá lại, kiểm tra tồn kho và sở hữu đơn.

### Quy ước Payment đã chốt
- `idempotencyKey` là UUID và duy nhất theo user. Cùng user + key + order + method trả lại Payment đã lưu, không gọi gateway lần hai.
- Dùng lại key với order hoặc method khác trả `409`. Request trùng khi bản ghi nội bộ còn `PROCESSING` cũng trả `409` để client kiểm tra lại, không tự phát lệnh mới.
- `PROCESSING` là trạng thái nội bộ trong database, không phải success response của API. Gateway ném lỗi/timeout được chốt thành `UNKNOWN`; Order port phải giữ trạng thái hiện tại và cho phép truy vấn xác minh.
- Backend lấy `amount` từ Order của user, không nhận giá hoặc `userId` từ request. `404` dùng khi không tìm thấy đơn thuộc user; order ngoài `PENDING/PAYMENT_FAILED` trả `409`.
- `PaymentsModule.register(...)` cần import OrdersModule và provider cho token `PAYMENT_ORDER_PORT`. Migration Payment hiện chưa có khóa ngoại `order_id`; TV4 thêm khóa này khi bảng `orders` được hợp nhất.
- Mock gateway mặc định trả `PAID`; môi trường test có thể đặt `MOCK_PAYMENT_OUTCOME=PAID|PAYMENT_FAILED|UNKNOWN`.

## Endpoint bổ sung đề xuất, chưa thuộc 7 endpoint chính thức
- GET `/auth/me`: TV1, JWT bắt buộc, trả `{user}`; 401 khi hết hạn. Đã triển khai.
- POST `/auth/logout`: TV1, cần JWT hợp lệ; tăng `users.session_version` rồi xóa cookie. JWT cũ trả 401 ngay sau đó. Đã kiểm tra với PostgreSQL QA.
- GET `/orders/:id`: TV4, CUSTOMER, trả `Order` cùng cấu trúc POST; 404 nếu không tồn tại hoặc không thuộc người đăng nhập, 400 nếu UUID sai. Đã có backend.
- GET `/orders/:id/status`: TV4, cùng auth/ownership; trả JSON `{ "status": "PENDING" }`. REST adapter unwrap thành `OrderStatus` theo interface frontend. Đã có backend.
- POST `/promotions/validate`: TV6, `{code,subtotal}` → `{code,discount}`.
- GET `/loyalty/me`: TV6, `{points}`.
- GET `/staff/orders`: TV4, BARISTA, `Order[]` trạng thái PAID/PREPARING/READY, cũ nhất trước. Đã có backend.
- PATCH `/staff/orders/:id/status`: TV4, BARISTA, `{status:"PREPARING"|"READY"|"COMPLETED"|"CANCELLED"}` → `Order`; 400 payload/UUID sai, 401/403 auth/Origin, 404 không tồn tại, 409 chuyển trạng thái sai hoặc xung đột. Không cho staff đặt PAID/PENDING/PAYMENT_FAILED. Đã có backend.
- GET `/staff/orders/:id`: TV4, chỉ BARISTA; frontend adapter đã chuẩn bị, backend chưa có.
- PATCH `/staff/orders/:id/cancel`: TV4, chỉ BARISTA, yêu cầu lý do; frontend adapter đã chuẩn bị, backend chưa có.
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

## Hợp đồng Staff Orders: phần đã có và phần còn mở rộng

| Endpoint | Input | Output cần có | Kiểm tra server |
|---|---|---|---|
| GET `/staff/orders` | Cookie/JWT BARISTA | `Order[]` PAID/PREPARING/READY | Đã có backend; 401 thiếu phiên, 403 CUSTOMER; lịch sử terminal chưa có |
| GET `/staff/orders/:id` | ID đường dẫn | `Order` hoặc 404 | Chưa có backend |
| PATCH `/staff/orders/:id/status` | `{status: "PREPARING"|"READY"|"COMPLETED"}` | `Order` mới nhất | Đã có backend; sai bước 409, transaction chống race |
| PATCH `/staff/orders/:id/cancel` | `{reason: string}` (1–300 ký tự) | `Order` với `status:"CANCELLED",cancelReason` | Chưa có backend; không dùng PATCH status=CANCELLED để bỏ qua lý do |

`Order` trả `id,userId,items,subtotal,discount,total,status,createdAt`; UI có thể dùng thêm `customerName,cancelReason,completedAt`. Backend hiện chưa trả các trường mở rộng này. `completedAt` cần là thời điểm bàn giao nếu KPI “đã giao hôm nay” phải chính xác. Các item cần `quantity,name,size,toppingNames,ice,sugar,note,unitPrice`. Danh sách chờ pha chỉ nhận PAID; mọi endpoint Orders CUSTOMER phải kiểm tra ownership trên server.

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
