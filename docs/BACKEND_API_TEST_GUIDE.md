# Hướng dẫn test các luồng chính backend BrewLite

Ngày đối chiếu mã nguồn: 2026-11-14. Base URL mặc định: `http://localhost:3001/api`.

Tài liệu này liệt kê các endpoint đang được đăng ký trong AppModule và các module con, JSON body, quyền truy cập, thứ tự thao tác và kết quả cần kiểm tra. Collection đi kèm: [BrewLite_Backend.postman_collection.json](postman/BrewLite_Backend.postman_collection.json). Đây là kịch bản test, không phải xác nhận toàn bộ API đã chạy thành công trên DB thật.

## 1. Chuẩn bị

1. Cấu hình `.env` theo README: DATABASE_URL trỏ đúng DB test, PORT=3001, JWT_SECRET và FRONTEND_ORIGIN chứa `http://localhost:3000`. Không dùng DB của nhóm khác để chạy nhánh thay công thức kho.
2. Mở Docker Desktop, từ root repo chạy các lệnh dưới đây. Nếu dùng PostgreSQL riêng thì bỏ lệnh Compose và cấu hình DB tương ứng.
3. Seed phải có ADMIN_EMAIL/ADMIN_PASSWORD, BARISTA_EMAIL/BARISTA_PASSWORD trong môi trường tiến trình. Có thể dùng seed bên trong backend Compose theo README nếu chạy cả stack. Không có endpoint đăng ký công khai Admin/Barista.

```powershell
docker compose up -d postgres mailpit
npm --prefix backend ci
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
npm --prefix backend run start:dev
```

Lệnh migrate/seed cần đọc đúng DATABASE_URL (Prisma dùng cấu hình env của repo; nếu báo thiếu biến, nạp biến của .env vào tiến trình trước). Không dùng prisma db push thay lịch sử migration. Nếu sản phẩm chưa có cấu hình size/công thức, xem các seed `prisma:seed-customization`, `prisma:seed-inventory` và [INGREDIENT_INVENTORY.md](INGREDIENT_INVENTORY.md); không chạy seed ghi đè công thức lên dữ liệu dùng chung.

## 2. Các ca lỗi cần thử thêm

| Ca test | Cách thực hiện | Kỳ vọng |
|---|---|---|
| Chưa đăng nhập | Xóa cookie jar rồi GET /auth/me, /orders/me hoặc /staff/orders | 401 |
| Sai role | Login khách rồi GET /staff/orders hoặc /staff/inventory | 403 |
| Không có cookie Admin | GET /auth/admin/me hoặc /admin/payments bằng phiên khách | 401 |
| Staff gọi Orders khách | Login Barista rồi GET /orders/me | 403 |
| Truy cập đơn người khác | Login khách thứ hai, GET /orders/:id của khách đầu | 404, không lộ đơn |
| CSRF Origin | Có cookie, gửi PATCH/POST với Origin khác hoặc không có Origin | 403 |
| JSON sai DTO | quantity=0/100, size=XL, ice/sugar sai enum, UUID sai, thêm total/discountAmount vào CreateOrder | 400 |
| Size/topping hết hoặc không thuộc món | Dùng ID có thật nhưng lựa chọn không hợp lệ | 422 cho lựa chọn không hợp lệ; kiểm thông báo nghiệp vụ |
| Giỏ vượt nguyên liệu | Tăng quantity vượt capacity hoặc nhiều món dùng chung nguyên liệu | Bị từ chối, không giữ/trừ kho một phần |
| UUID hợp lệ nhưng không tồn tại | GET /products/00000000-0000-4000-8000-000000000000 | 404 |
| Chuyển trạng thái bỏ bước | PAID → COMPLETED qua staff status | 409 |
| Hủy bằng status | PATCH staff status với CANCELLED | 400; phải dùng /cancel và reason |
| Lý do trống | Staff cancel reason rỗng | 400 |
| Payment thiếu key | POST /payments không idempotencyKey và không header Idempotency-Key | 400 |
| Key header/body lệch | Gửi hai UUID khác nhau ở header và body | 400 |
| Token reset đã dùng/hết hạn | Gửi lại reset-password | Bị từ chối, mật khẩu không đổi lần hai |
| Cạnh tranh kho | Hai khách đặt lượng tồn cuối đồng thời | Chỉ lượng đủ kho thành công; không âm kho, transaction còn lại rollback |

Rate limit auth có thể trả 429 khi lặp nhiều request. Sau lỗi kiểm tra lại Order/Payment/kho, không chỉ nhìn HTTP. Collection kiểm mã HTTP và một số invariant chính; các điều kiện tồn kho, quyền sở hữu và tác dụng phụ trong checklist cần xác minh thêm.

## 3. Danh mục endpoint và JSON để copy

Mọi đường dẫn dưới đây ghép sau baseUrl (đã có /api). HTTP là kết quả kỳ vọng khi thỏa tiền điều kiện; POST mặc định Nest trả 201, trừ endpoint gắn HttpCode(200). Các request trùng endpoint thể hiện các bước/nhánh test khác nhau.

### 01 Auth - khách hàng

**01 Đăng ký** — `POST /auth/register`

Quyền: Công khai. HTTP kỳ vọng: **201**. Dùng email mới mỗi lượt đăng ký. Response user.role phải là CUSTOMER. Cookie jar tự lưu brewlite_session.

```json
{
  "name": "Khách QA",
  "email": "ABCDK@gmail.com",
  "password": "{{customerPassword123}}"
}
```

**02 Đăng nhập khách** — `POST /auth/login`

Quyền: Công khai. HTTP kỳ vọng: **201**.  
Origin: http://localhost:3000.
Content-Type: application/json

```json
{
  "email": "ABCDK@gmail.com",
  "password": "{{customerPassword123}}"
}
```

**03 Hồ sơ khách** — `GET /auth/me`

Quyền: JWT khách/Barista. HTTP kỳ vọng: **200**. Kiểm tra user.email và user.role.

Body: không có.

### 02 Catalog - tồn kho chỉ đọc

**01 Health** — `GET /`

Quyền: Công khai. HTTP kỳ vọng: **200**. Chỉ xác nhận tiến trình HTTP, không chứng minh DB sẵn sàng.

Body: không có.

**02 Danh sách sản phẩm** — `GET /products`

Quyền: Công khai. HTTP kỳ vọng: **200**. Chọn món còn stock > 0; tự lưu productId.

Body: không có.

**03 Chi tiết sản phẩm** — `GET /products/{{productId}}`
productID: 31a650c7-8597-4a01-a8e2-000000000001.

Quyền: Công khai. HTTP kỳ vọng: **200**. Tự chọn size còn hàng; lưu productSizeId và toppingId nếu có.

Body: không có.

**04 Kiểm tra giỏ trước checkout** — `POST /products/availability`

Quyền: Công khai. HTTP kỳ vọng: **200**. Kỳ vọng valid=true; không giữ/trừ kho.

```json
{
  "items": [
    {
      "productId": "31a650c7-8597-4a01-a8e2-000000000001",
      "size": "M",
      "toppingIds": [],
      "quantity": 1,
      "ice": "70% đá",
      "sugar": "50% ít ngọt",
      "note": "Test backend"
    }
  ]
}

```

**05 Xem trước lựa chọn** — `POST /products/preview`

Quyền: Công khai. HTTP kỳ vọng: **200**. Kiểm tra valid, canAdd, currentShortages/nextShortages; không trừ kho.

```json
{
  "candidate": {
    "productId": "31a650c7-8597-4a01-a8e2-000000000001",
    "size": "M",
    "toppingIds": [],
    "quantity": 1,
    "ice": "70% đá",
    "sugar": "50% ít ngọt",
    "note": "Test backend"
  },
  "cartItems": []
}
```



### 03 Orders - tạo và theo dõi

**01 Tạo đơn mới** — `POST /orders`

Quyền: CUSTOMER. HTTP kỳ vọng: **201**. Tự lưu orderId, subtotal. Kỳ vọng PENDING, tổng do server tính; mỗi lần gửi tạo một đơn mới.

```json
{
  "items": [
    {
      "productId": "31a650c7-8597-4a01-a8e2-000000000001",
      "size": "M",
      "toppingIds": [],
      "quantity": 1,
      "ice": "70% đá",
      "sugar": "50% ít ngọt",
      "note": "Test backend"
    }
  ]
}
```

**02 Đơn của tôi** — `GET /orders/me`

Quyền: CUSTOMER. HTTP kỳ vọng: **200**. 

Body: không có.

**03 Chi tiết đơn** — `GET /orders/{{orderId}}`

Quyền: CUSTOMER. HTTP kỳ vọng: **200**. 

Body: không có.

**04 Trạng thái đơn** — `GET /orders/{{orderId}}/status`

Quyền: CUSTOMER. HTTP kỳ vọng: **200**. 

Body: không có.

### 04 Barista - pha chế và giao

**01 Đăng nhập Barista** — `POST /auth/login`

Quyền: Công khai. HTTP kỳ vọng: **201**. Ghi đè brewlite_session của khách. Muốn gọi Orders của khách phải đăng nhập khách lại.

```json
{
  "email": "{{baristaEmail}}",
  "password": "{{baristaPassword}}"
}
```

**02 Dashboard guard** — `GET /barista/dashboard`

Quyền: BARISTA. HTTP kỳ vọng: **200**. Endpoint hiện trả orders: []; dùng /staff/orders để kiểm queue thật.

Body: không có.

**03 Queue và lịch sử** — `GET /staff/orders`

Quyền: BARISTA. HTTP kỳ vọng: **200**. 

Body: không có.

**04 Chi tiết đơn** — `GET /staff/orders/{{orderId}}`

Quyền: BARISTA. HTTP kỳ vọng: **200**. 

Body: không có.

**05 Chuyển PREPARING** — `PATCH /staff/orders/{{orderId}}/status`

Quyền: BARISTA. HTTP kỳ vọng: **200**. Chạy đúng thứ tự PAID → PREPARING → READY → COMPLETED.

```json
{
  "status": "PREPARING"
}
```

**06 Chuyển READY** — `PATCH /staff/orders/{{orderId}}/status`

Quyền: BARISTA. HTTP kỳ vọng: **200**. Chạy đúng thứ tự PAID → PREPARING → READY → COMPLETED.

```json
{
  "status": "READY"
}
```

**07 Chuyển COMPLETED** — `PATCH /staff/orders/{{orderId}}/status`

Quyền: BARISTA. HTTP kỳ vọng: **200**. Chạy đúng thứ tự PAID → PREPARING → READY → COMPLETED.

```json
{
  "status": "COMPLETED"
}
```

### 05 Nhánh riêng - thất bại và retry

**01 Retry thanh toán** — `POST /payments`

Quyền: CUSTOMER. HTTP kỳ vọng: **201**. Đăng nhập khách; chỉ retry sau PAYMENT_FAILED. Key mới cho attempt mới.

```json
{
  "orderId": "{{orderId}}",
  "method": "ADMIN_APPROVAL",
  "idempotencyKey": "{{$guid}}"
}
```

### 06 Nhánh riêng - hủy đơn

**01 Khách hủy trực tiếp** — `POST /orders/{{orderId}}/cancel`

Quyền: CUSTOMER. HTTP kỳ vọng: **201**. Chỉ PENDING/PAYMENT_FAILED và không có Admin payment PROCESSING. Dùng đơn mới riêng.

```json
{
  "reason": "Khách đổi ý khi test"
}
```

**02 Barista hủy có lý do** — `PATCH /staff/orders/{{orderId}}/cancel`

Quyền: BARISTA. HTTP kỳ vọng: **200**. Dùng đơn riêng ở trạng thái cho phép hủy theo state machine, không dùng đơn COMPLETED.

```json
{
  "reason": "Thiếu nguyên liệu trong lượt test"
}
```

### 07 VNPAY Sandbox - thao tác thủ công

**01 Tạo giao dịch VNPAY** — `POST /payments`

Quyền: CUSTOMER. HTTP kỳ vọng: **201**. Dùng Order mới chưa có Payment đang xử lý. Mở paymentUrl trong trình duyệt và thanh toán bằng phương tiện TEST.

```json
{
  "orderId": "{{orderId}}",
  "method": "VNPAY_QR",
  "idempotencyKey": "{{idempotencyKey}}"
}
```

**02 Đối soát QueryDR** — `POST /payments/{{orderId}}/reconcile`

Quyền: CUSTOMER. HTTP kỳ vọng: **200**. Cần cấu hình QueryDR và IP egress. Có thể vẫn PROCESSING khi gateway chưa chốt; không tạo attempt song song.

Body: không có.

**03 IPN chữ ký sai - negative** — `GET /payments/vnpay/ipn?vnp_SecureHash=invalid`

Quyền: Công khai. HTTP kỳ vọng: **200**. Callback GET dùng query, không JSON body. Kỳ vọng RspCode 97, DB không đổi.

Body: không có.

**04 Return chữ ký sai - negative** — `GET /payments/vnpay/return?vnp_SecureHash=invalid`

Quyền: Công khai. HTTP kỳ vọng: **302**. Tắt Automatically follow redirects trong request Settings để quan sát 302. Return không ghi kết quả vào DB.

Body: không có.

### 08 Loyalty và voucher

**01 Điểm cá nhân** — `GET /loyalty/me`

Quyền: JWT khách/Barista. HTTP kỳ vọng: **200**. Đăng nhập lại khách sau luồng Barista.

Body: không có.

**02 Voucher khả dụng** — `GET /loyalty/vouchers`

Quyền: JWT khách/Barista. HTTP kỳ vọng: **200**. 

Body: không có.

**03 Đổi 50 điểm** — `POST /loyalty/redeem`

Quyền: JWT khách/Barista. HTTP kỳ vọng: **201**. Cần ít nhất 50 điểm. rw-20k cần 100; rw-50k cần 200. Thiếu điểm trả 400.

```json
{
  "rewardId": "rw-10k"
}
```

**04 Kiểm tra mã ưu đãi** — `POST /promotions/validate`

Quyền: JWT khách/Barista. HTTP kỳ vọng: **201**. Đăng nhập owner; subtotal ở đây chỉ xem trước. Khi tạo Order backend tính lại.

```json
{
  "code": "{{promotionCode}}",
  "subtotal": 100000
}
```

**05 Tạo đơn dùng voucher** — `POST /orders`

Quyền: CUSTOMER. HTTP kỳ vọng: **201**. Cần voucher AVAILABLE của khách này và đủ minOrderValue. Tự lưu orderId mới; không chạy sau happy path nếu còn cần orderId cũ.

```json
{
  "items": [
    {
      "productId": "{{productId}}",
      "size": "{{size}}",
      "toppingIds": [],
      "quantity": 1,
      "ice": "70% đá",
      "sugar": "50% ít ngọt",
      "note": "Test backend"
    }
  ],
  "promotionCode": "{{promotionCode}}"
}
```
### 09 Mật khẩu và đăng xuất - chạy cuối

**01 Quên mật khẩu** — `POST /auth/forgot-password`

Quyền: Công khai. HTTP kỳ vọng: **201**. Lấy token từ link trong email Mailpit http://localhost:8025; response không tiết lộ email tồn tại.

```json
{
  "email": "{{customerEmail}}"
}
```

**02 Reset mật khẩu** — `POST /auth/reset-password`

Quyền: Công khai. HTTP kỳ vọng: **201**. Token một lần, 15 phút; phiên cũ bị vô hiệu. Sau đó cập nhật customerPassword và đăng nhập lại.

```json
{
  "token": "{{resetToken}}",
  "newPassword": "{{newPassword}}"
}
```

**03 Đổi mật khẩu** — `POST /auth/change-password`

Quyền: JWT khách/Barista. HTTP kỳ vọng: **201**. Phải có phiên khách hợp lệ. Dùng như nhánh riêng; cập nhật customerPassword sau thành công và đăng nhập lại.

```json
{
  "oldPassword": "{{customerPassword}}",
  "newPassword": "{{newPassword}}"
}
```

**04 Logout khách hoặc Barista** — `POST /auth/logout`

Quyền: JWT khách/Barista. HTTP kỳ vọng: **201**. Vô hiệu mọi phiên của tài khoản hiện tại; gọi /auth/me sau đó phải 401.

Body: không có.
