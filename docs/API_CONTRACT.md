# Hợp đồng API BrewLite

Base URL: `http://localhost:3001/api`. JSON; tiền là số nguyên VND. Cookie `brewlite_session` HttpOnly, SameSite=Lax; request từ browser phải dùng `credentials: include`. Lỗi NestJS: `{statusCode, message, error}`; `message` có thể là chuỗi hoặc mảng. Các DTO đơn hàng/thanh toán dưới đây là hợp đồng cần TV4/TV5 xác nhận, chưa có backend thật.

## Endpoint chính thức

| Chủ sở hữu | Method và đường dẫn | Auth | Request DTO | Success response | Lỗi | Màn hình | Trạng thái |
|---|---|---|---|---|---|---|---|
| TV2 | GET `/products` | Không | Không | `ProductListItem[]` | 500 DB | Menu | Backend + PostgreSQL HTTP đã xác minh |
| TV2 | GET `/products/:id` | Không | UUID path | `ProductDetail` | 400 UUID, 404, 500 | Chi tiết | Backend + PostgreSQL HTTP đã xác minh |
| TV1 | POST `/auth/register` | Không | `{name,email,password}` | `{user}` và cookie | 400, 409 | Đăng ký | Backend + PostgreSQL HTTP đã xác minh |
| TV1 | POST `/auth/login` | Không | `{email,password}` | `{user}` và cookie | 400, 401 | Đăng nhập | Backend + PostgreSQL HTTP đã xác minh |
| TV4 | POST `/orders` | CUSTOMER | `{items:[{productId,size,toppingIds,quantity,ice,sugar,note?}],promotionCode?}` (`note` ≤ 120 ký tự, ghi chú cho Barista) | `Order` PENDING | 400, 401, 409, 422 | Checkout | Chỉ có adapter frontend |
| TV5 | POST `/payments` | CUSTOMER | `{orderId,method,idempotencyKey}` | `Payment` PAID/PAYMENT_FAILED/UNKNOWN | 400, 401, 404, 409 | Xử lý/kết quả | Core/controller/schema có; chờ Orders port để bật module |
| TV4+TV6 | GET `/orders/me` | CUSTOMER | Không | `Order[]` | 401, 500 | Đơn của tôi | Chỉ có adapter frontend |

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

### Ví dụ Orders và Payments (đề xuất để tích hợp)
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
- GET `/orders/:id`, GET `/orders/:id/status`: TV4, xác minh và theo dõi.
- POST `/promotions/validate`: TV6, `{code,subtotal}` → `{code,discount}`.
- GET `/loyalty/me`: TV6, `{points}`.
- GET `/staff/orders`, GET `/staff/orders/:id`, PATCH `/staff/orders/:id/status`, PATCH `/staff/orders/:id/cancel`: TV4, chỉ BARISTA; chưa có backend.
- GET `/barista/dashboard`: TV1, endpoint mẫu kiểm tra guard BARISTA; đã triển khai, không phải Orders API.

## Kiểu chung
Xem `frontend/src/types/domain.ts`: `User`, `Role`, `Product`, `ProductSize`, `Topping`, `CartItem`, `Order`, `OrderItem` (item trong `Order.items`), `Payment`, `Promotion`, `LoyaltyPoints`, `OrderStatus`. Trạng thái: `PENDING → PAID → PREPARING → READY → COMPLETED`; nhánh `PAYMENT_FAILED`, retry về PENDING, `CANCELLED` từ PENDING/PAID/PAYMENT_FAILED. COMPLETED/CANCELLED kết thúc. Không cho hủy PREPARING nếu chưa thống nhất extension.

## Quy tắc chờ thống nhất
- Chênh lệch giá S/M/L, topping: backend Product API là nguồn chuẩn; mock có giá minh họa riêng.
- Eligibility ưu đãi và trần giảm: demo chỉ nhận `BREW10`, giảm tối đa 10.000 VND; không phải chính sách thật.
- Tỷ lệ tích điểm/đổi điểm: demo `floor(total/10000)` sau PAID; TV6 định nghĩa thật.
- Reservation/release tồn kho và race condition: TV4 xác định trong transaction.
- Payment retention/cleanup và thời hạn coi bản ghi `PROCESSING` là treo vẫn cần nhóm thống nhất; quy tắc replay và `UNKNOWN` đã chốt ở trên.
- Barista cancellation khi PREPARING: chưa được phép trong UI demo.

## Hợp đồng Staff Orders cho TV4 (frontend đã nối adapter, server còn chờ)

| Endpoint | Input | Output cần có | Kiểm tra server |
|---|---|---|---|
| GET `/staff/orders` | Cookie/JWT BARISTA | `Order[]` gồm PAID/PREPARING/READY và COMPLETED/CANCELLED lịch sử | 401 thiếu phiên, 403 CUSTOMER |
| GET `/staff/orders/:id` | ID đường dẫn | `Order` hoặc 404 | 401/403, không lộ dữ liệu ngoài quyền |
| PATCH `/staff/orders/:id/status` | `{status: "PREPARING"|"READY"|"COMPLETED"}` | `Order` mới nhất | Chỉ PAID→PREPARING→READY→COMPLETED; sai bước 409; transaction chống race |
| PATCH `/staff/orders/:id/cancel` | `{reason: string}` (1–300 ký tự) | `Order` với `status:"CANCELLED",cancelReason` | Chỉ PENDING/PAID/PAYMENT_FAILED đến khi nhóm chốt mở rộng; lý do bắt buộc; không tuyên bố refund |

`Order` trả `id,userId,items,subtotal,discount,total,status,createdAt`, có thể thêm `customerName,cancelReason,completedAt`. `completedAt` phải là thời điểm xác nhận bàn giao nếu KPI “đã giao hôm nay” cần chính xác; không dùng `createdAt` để suy ra. Các item cần `quantity,name,size,toppingNames,ice,sugar,note,unitPrice`. Danh sách chờ pha chỉ nhận PAID; các trạng thái chưa thanh toán không được đưa vào hàng đợi. Mọi endpoint Orders của CUSTOMER phải suy user từ phiên và kiểm tra ownership trên server.

Auth response register/login/me/logout đặt `Cache-Control: no-store`. Cookie `brewlite_session` được ký JWT với `sessionVersion`; phiên cũ 401 sau logout. Migration `20261016000000_session_version` chỉ thêm cột mặc định 0, không xóa dữ liệu.
