# Hợp đồng API BrewLite

Base URL: `http://localhost:3001/api`. JSON; tiền là số nguyên VND. Cookie `brewlite_session` HttpOnly, SameSite=Lax; request từ browser phải dùng `credentials: include`. Lỗi NestJS: `{statusCode, message, error}`; `message` có thể là chuỗi hoặc mảng. Các DTO đơn hàng/thanh toán dưới đây là hợp đồng cần TV4/TV5 xác nhận, chưa có backend thật.

## Endpoint chính thức

| Chủ sở hữu | Method và đường dẫn | Auth | Request DTO | Success response | Lỗi | Màn hình | Trạng thái |
|---|---|---|---|---|---|---|---|
| TV2 | GET `/products` | Không | Không | `ProductListItem[]` | 500 DB | Menu | Backend + PostgreSQL HTTP đã xác minh |
| TV2 | GET `/products/:id` | Không | UUID path | `ProductDetail` | 400 UUID, 404, 500 | Chi tiết | Backend + PostgreSQL HTTP đã xác minh |
| TV1 | POST `/auth/register` | Không | `{name,email,password}` | `{user}` và cookie | 400, 409 | Đăng ký | Backend + PostgreSQL HTTP đã xác minh |
| TV1 | POST `/auth/login` | Không | `{email,password}` | `{user}` và cookie | 400, 401 | Đăng nhập | Backend + PostgreSQL HTTP đã xác minh |
| TV4 | POST `/orders` | CUSTOMER | `{items:[{productId,size,toppingIds,quantity,ice,sugar}],promotionCode?}` | `Order` PENDING | 400, 401, 409, 422 | Checkout | Chỉ có adapter frontend |
| TV5 | POST `/payments` | CUSTOMER | `{orderId,method,idempotencyKey}` | `Payment` PAID/PAYMENT_FAILED/UNKNOWN | 400, 401, 409 | Xử lý/kết quả | Chỉ có adapter frontend |
| TV4+TV6 | GET `/orders/me` | CUSTOMER | Không | `Order[]` | 401, 500 | Đơn của tôi | Chỉ có adapter frontend |

### Ví dụ Products
`GET /products` → `[{"id":"uuid","name":"Bạc xỉu","price":29000,"imageUrl":"/images/products/sample-milk-coffee.svg","stock":40,"description":"..."}]`.
`GET /products/uuid` → `{"id":"uuid","name":"Bạc xỉu","price":29000,"stock":40,"description":"...","imageUrl":"/...svg","sizes":[{"id":"uuid","code":"S","name":"Nhỏ","extraPrice":0,"available":true}],"toppings":[{"id":"uuid","name":"Kem sữa","extraPrice":6000,"available":true}],"defaultSizeId":"uuid"}`. Backend trả đủ S/M/L.

### Ví dụ Auth
`POST /auth/register` body `{"name":"An","email":"an@example.test","password":"Password123"}` → `201 {"user":{"id":"uuid","email":"an@example.test","name":"An","role":"CUSTOMER","loyaltyPoints":0}}`; header Set-Cookie. Role gửi từ client bị từ chối 400. Email trùng 409. `POST /auth/login` body `{"email":"an@example.test","password":"Password123"}` → cùng user/cookie; sai mật khẩu 401. Không trả JWT trong JSON.

### Ví dụ Orders và Payments (đề xuất để tích hợp)
`POST /orders` body `{"items":[{"productId":"uuid","size":"M","toppingIds":[],"quantity":2,"ice":"70% đá","sugar":"50% ít ngọt"}]}` → `201 {"id":"uuid","userId":"uuid","items":[...],"subtotal":98000,"discount":0,"total":98000,"status":"PENDING","createdAt":"2026-10-14T00:00:00Z"}`. `POST /payments` body `{"orderId":"uuid","method":"WALLET","idempotencyKey":"uuid"}` → `201 {"id":"uuid","orderId":"uuid","method":"WALLET","status":"PAID","idempotencyKey":"uuid"}`. Lỗi gateway được trả bằng `PAYMENT_FAILED`, timeout/chưa chắc chắn là `UNKNOWN`. `GET /orders/me` → mảng Order cùng cấu trúc. Backend phải tính giá lại, kiểm tra tồn kho và sở hữu đơn.

## Endpoint bổ sung đề xuất, chưa thuộc 7 endpoint chính thức
- GET `/auth/me`: TV1, JWT bắt buộc, trả `{user}`; 401 khi hết hạn. Đã triển khai.
- POST `/auth/logout`: TV1, xóa cookie; đã triển khai. JWT đã cấp là stateless đến khi hết hạn, xem `ARCHITECTURE.md`.
- GET `/orders/:id`, GET `/orders/:id/status`: TV4, xác minh và theo dõi.
- POST `/promotions/validate`: TV6, `{code,subtotal}` → `{code,discount}`.
- GET `/loyalty/me`: TV6, `{points}`.
- GET `/staff/orders`, PATCH `/staff/orders/:id/status`: TV4, chỉ BARISTA.
- GET `/barista/dashboard`: TV1, endpoint mẫu kiểm tra guard BARISTA; đã triển khai, không phải Orders API.

## Kiểu chung
Xem `frontend/src/types/domain.ts`: `User`, `Role`, `Product`, `ProductSize`, `Topping`, `CartItem`, `Order`, `OrderItem` (item trong `Order.items`), `Payment`, `Promotion`, `LoyaltyPoints`, `OrderStatus`. Trạng thái: `PENDING → PAID → PREPARING → READY → COMPLETED`; nhánh `PAYMENT_FAILED`, retry về PENDING, `CANCELLED` từ PENDING/PAID/PAYMENT_FAILED. COMPLETED/CANCELLED kết thúc. Không cho hủy PREPARING nếu chưa thống nhất extension.

## Quy tắc chờ thống nhất
- Chênh lệch giá S/M/L, topping: backend Product API là nguồn chuẩn; mock có giá minh họa riêng.
- Eligibility ưu đãi và trần giảm: demo chỉ nhận `BREW10`, giảm tối đa 10.000 VND; không phải chính sách thật.
- Tỷ lệ tích điểm/đổi điểm: demo `floor(total/10000)` sau PAID; TV6 định nghĩa thật.
- Reservation/release tồn kho và race condition: TV4 xác định trong transaction.
- Payment retry/idempotency: TV5 xác định thời hạn khóa và semantics của trạng thái UNKNOWN.
- Barista cancellation khi PREPARING: chưa được phép trong UI demo.
