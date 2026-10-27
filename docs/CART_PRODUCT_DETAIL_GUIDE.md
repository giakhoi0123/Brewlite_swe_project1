# Hướng dẫn: Chi tiết sản phẩm, thêm vào giỏ và quản lý giỏ hàng

Tài liệu giải thích phần **xem chi tiết sản phẩm → tùy chỉnh → thêm vào giỏ → quản lý giỏ → đặt đơn** của BrewLite (TV3): code nằm ở đâu, dữ liệu chạy thế nào, quy tắc nghiệp vụ, cách chạy thử và kiểm thử. Đường dẫn tính từ thư mục gốc repo.

> Từ 2026-10-24 giỏ hàng quay về **thiết kế ban đầu: chỉ dùng Zustand (localStorage)**. Frontend không còn gọi `/api/cart`.

## 1. Luồng tổng thể

```
GET /api/products/:id
        │
        ▼
[Trang chi tiết] ──add()──► [Zustand store: stores/cart.ts] ◄──► localStorage "brewlite-cart-v1"
 products/[id]/page.tsx              │
                                     ├──► [Trang giỏ] cart/page.tsx  (sửa số lượng, size, xóa)
                                     │
                                     └──► [Checkout] checkout/page.tsx
                                                │  items (chỉ cấu hình, không gửi giá)
                                                ▼
                                     POST /api/orders ──► Backend tính lại giá, kiểm tồn kho, tạo đơn PENDING
                                                │
                                                ▼
                                     Thanh toán VNPAY ──► Đơn PAID ──► useCart.clear()
```

Ba nguyên tắc:

1. **Giỏ chỉ ở trình duyệt.** Khách hay người đã đăng nhập đều dùng chung một store Zustand, lưu localStorage, nên refresh không mất giỏ.
2. **Giá trong giỏ chỉ để hiển thị.** Khi đặt đơn, frontend gửi cấu hình món (sản phẩm, size, topping, đá, đường, ghi chú, số lượng); **backend tính lại giá và kiểm tồn kho**.
3. **Cùng cấu hình thì gộp dòng.** Cùng sản phẩm + size + topping + đá + đường + ghi chú → cộng số lượng (tối đa 99).

## 2. Bản đồ file

| Lớp | File | Vai trò |
|---|---|---|
| UI | `frontend/src/app/products/[id]/page.tsx` | Trang chi tiết: size, topping, đá, đường, ghi chú, số lượng, Thêm vào giỏ / Mua ngay / Thêm nhanh |
| UI | `frontend/src/app/cart/page.tsx` | Trang giỏ: đổi size, số lượng, xóa, xóa tất cả, mã ưu đãi, cảnh báo tồn kho |
| UI | `frontend/src/app/checkout/page.tsx` | Lấy `items` từ store, gọi `services.orders.create` |
| UI | `frontend/src/components/shell.tsx` | Badge số món trên header (đọc `items` từ store) |
| State | `frontend/src/stores/cart.ts` | **Store giỏ hàng — phần cốt lõi** |
| Kiểu | `frontend/src/types/domain.ts` | `Product`, `CartItem`, `itemKey`, `lineTotal`, `cartTotal`, `money` |
| Service | `frontend/src/services/index.ts` | Chọn mock/API cho products, orders… (giỏ không có service) |
| Service | `frontend/src/services/api.ts` | `apiProducts`, `apiOrders.create` → `POST /orders` |
| Service | `frontend/src/services/mock.ts` | `mockProducts`, `mockOrders` |
| Test | `frontend/src/stores/cart.test.ts` | Unit test store |
| Backend | `backend/src/products/*` | `GET /products`, `GET /products/:id` |
| Backend | `backend/src/orders/dto/create-order.dto.ts` | Validate items khi đặt đơn |

`backend/src/cart` và bảng `carts`/`cart_items` vẫn còn trong repo (để không phải sửa phần Orders/Payment của TV4/TV5) nhưng **frontend không dùng**.

## 3. Trang chi tiết sản phẩm

File: `frontend/src/app/products/[id]/page.tsx`

| Việc | Ở đâu | Giải thích |
|---|---|---|
| Tải sản phẩm | `load()` | `services.products.get(id)`; chọn sẵn size có `isDefault`. Lỗi → `ErrorState` có nút thử lại; `null` → "Không tìm thấy sản phẩm" |
| Món liên quan | effect thứ hai | `services.products.list()`, bỏ món hiện tại, lấy 4 món |
| Tính giá | biến `unit` | `giá gốc + phụ thu size + tổng giá topping`; tổng = `unit * quantity` |
| Tồn kho | `inCart`, `overStock` | **Số phần món này đã có trong giỏ (mọi cấu hình) + số lượng định thêm** phải ≤ `stock` |
| Chặn mua | `invalid`, `blocked` | Size/topping tạm hết, hoặc `overStock` → khóa nút, hiện "Chỉ còn N phần (giỏ đã có X phần)" |
| Thêm vào giỏ | `submit(next)` | Tạo `CartItem` (có `key = itemKey(...)`), gọi `add()`, chuyển tới `/cart` hoặc `/checkout` |
| Thêm nhanh | `quickAdd(p)` | Size mặc định, không topping, `100% đá`, `100% chuẩn`, số lượng 1 |

Lưu ý:

- `ICE`, `SUGAR` khai báo cứng đầu file **phải trùng** `ICE_LEVELS`, `SUGAR_LEVELS` ở backend (`backend/src/cart/cart-pricing.ts`, được DTO Orders dùng), nếu không `POST /orders` trả 400.
- Ghi chú tối đa 120 ký tự (trùng DTO Orders).
- Phần `stories` (thành phần, nguồn gốc, chỉ số hương vị) là **nội dung tĩnh** theo nhóm món.
- Ở chế độ API, `category` luôn là `"Thực đơn"` (gán trong `normalize` của `api.ts`) vì backend chưa có category; danh sách sản phẩm không có `sizes`, nên "Thêm nhanh" chỉ hoạt động ở chế độ mock.

Backend `ProductsService.findOne` kiểm dữ liệu cấu hình: đủ 3 size S/M/L, đúng 1 size mặc định còn bán, phụ thu là số nguyên ≥ 0. Dữ liệu sai → 500; không có sản phẩm → 404 (frontend đổi thành `null`).

## 4. Store giỏ hàng — `frontend/src/stores/cart.ts`

Zustand + middleware `persist`: lưu `items` và `promoCode` vào localStorage key `brewlite-cart-v1`.

### Trạng thái và hàm

| Thành phần | Ý nghĩa |
|---|---|
| `items: CartItem[]` | Các dòng trong giỏ |
| `promoCode: string` | Mã ưu đãi đã áp dụng (checkout dùng lại) |
| `add(item)` | Thêm; trùng `key` thì cộng số lượng (`merge`) |
| `setQuantity(key, n)` | Đặt số lượng, kẹp trong 1–99 |
| `changeSize(key, size, unitPrice)` | Đổi size → tính `key` mới; trùng dòng khác thì gộp, không thì giữ vị trí |
| `remove(key)` | Xóa một dòng |
| `clear()` | Xóa hết + bỏ mã ưu đãi; trả `Promise<boolean>` để luồng thanh toán chờ |
| `setPromoCode(code)` | Lưu mã ưu đãi |

```ts
add: (item) => set((s) => ({ items: merge(s.items, item) })),
```

### Các hàm phụ

- `merge(items, item)`: trùng `key` → cộng số lượng (≤ 99); không trùng → thêm cuối.
- `clampQuantity(n)`: làm tròn xuống, kẹp 1–99.
- `itemKey(...)` (trong `domain.ts`): `productId|size|toppingIds đã sắp xếp|đá|đường|ghi chú`. Topping được sort nên thứ tự chọn không ảnh hưởng.
- `version: 2` + `migrate`: dữ liệu cũ (thời còn giỏ server, `key` là UUID, có `issue`) được tính lại `key`, bỏ trường thừa và gộp dòng trùng.

### Vì sao `clear()` trả Promise?

`clearCartAfterPaidOrder` (TV1/TV5, `services/payment-intent.ts`) nhận `() => Promise<boolean>` và chỉ xóa phiên thanh toán khi xóa giỏ thành công. Giữ chữ ký này để không phải sửa luồng thanh toán.

## 5. Trang giỏ hàng — `frontend/src/app/cart/page.tsx`

- **Đổi size** (`SizeControl`): đơn giá mới = `đơn giá cũ − phụ thu size cũ + phụ thu size mới`. Size tạm hết bị disable. Danh sách size lấy từ `item.sizeOptions` (lưu khi thêm) hoặc từ danh sách sản phẩm.
- **Số lượng**: `<Quantity>` → `setQuantity`.
- **Xóa / Xóa tất cả**: `remove(key)` / `clear()` (có `confirm`).
- **Cảnh báo tồn kho** (`stockIssue`): tải danh sách sản phẩm, cộng số lượng mọi dòng cùng món; vượt `stock` → hiện "X chỉ còn N phần" / "X đang hết hàng" dưới dòng đó và **khóa nút Tiến hành đặt hàng**.
- **Mã ưu đãi**: `services.promotions.validate`; mã đã lưu được kiểm tra lại khi tạm tính đổi, không còn hợp lệ thì tự bỏ.
- **Đặt hàng**: chưa đăng nhập → `/login?next=%2Fcheckout`; đã đăng nhập → `/checkout`. Đăng nhập/đăng ký **không làm thay đổi giỏ**.

## 6. Đặt đơn từ giỏ Zustand

1. `checkout/page.tsx` đọc `items = useCart((s) => s.items)`.
2. Bấm "Thanh toán qua VNPAY" → `services.orders.create(user.id, items, promotion)`.
3. `apiOrders.create` gửi `POST /api/orders`:
   ```json
   {
     "items": [{ "productId": "uuid", "size": "M", "toppingIds": ["uuid"], "quantity": 2,
                 "ice": "70% đá", "sugar": "50% ít ngọt", "note": "ít đá" }],
     "promotionCode": "BREW10"
   }
   ```
   Không có `unitPrice`; chủ đơn lấy từ cookie JWT.
4. Backend Orders (TV4): validate (`create-order.dto.ts`) → tính lại giá từ catalog → kiểm/giữ tồn kho → lưu đơn **PENDING**.
   - Hết hàng → **409**; size/topping không hợp lệ → **422**; body sai → **400**. Checkout báo lỗi, **giỏ giữ nguyên**, không tạo đơn.
5. Thanh toán VNPAY. Chỉ khi server xác nhận đơn **PAID**, trang `payment/[id]/[stage]` gọi `clear()`. Thanh toán thất bại → giỏ vẫn còn để thử lại.

## 7. Chế độ dữ liệu

| `NEXT_PUBLIC_DATA_MODE` | products | orders, payments, promotions, loyalty, barista | Giỏ |
|---|---|---|---|
| `api` (mặc định, bắt buộc khi thanh toán VNPAY) | API thật | API thật | Zustand |
| `hybrid` | API thật | mock | Zustand |
| `mock` | mock | mock | Zustand |

## 8. Chạy thử (PowerShell, Windows)

Yêu cầu: Docker Desktop đang chạy, đã `npm --prefix frontend ci` và `npm --prefix backend ci`, đã có `.env` ở gốc repo.

1. Bật PostgreSQL:
   ```powershell
   docker compose up -d postgres
   ```
2. Nạp `.env` vào terminal hiện tại (Prisma CLI cần `DATABASE_URL`):
   ```powershell
   Get-Content .env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
     $k, $v = $_ -split '=', 2
     Set-Item "env:$($k.Trim())" $v.Trim().Trim('"')
   }
   ```
3. Migrate và seed:
   ```powershell
   npm --prefix backend run prisma:generate
   npm run db:migrate
   npm run db:seed
   ```
4. `frontend/.env.local`:
   ```
   NEXT_PUBLIC_DATA_MODE=api
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   ```
5. Hai terminal:
   ```powershell
   npm run dev:backend
   npm run dev:frontend
   ```
6. Mở http://localhost:3000.

## 9. Kịch bản demo / tự kiểm tra

Mở DevTools → **Application → Local Storage → `brewlite-cart-v1`** và tab **Network**.

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở một món, chọn size M, bấm **Thêm vào giỏ hàng** | Sang `/cart`; localStorage có 1 dòng |
| 2 | Thêm **đúng cấu hình đó** lần nữa | Vẫn 1 dòng, số lượng tăng |
| 3 | Thêm cùng món nhưng đổi mức đá | Thành 2 dòng |
| 4 | Trong giỏ, đổi size dòng 2 cho trùng cấu hình dòng 1 | Hai dòng gộp làm một |
| 5 | Tăng số lượng, xóa một dòng, refresh | localStorage cập nhật ngay; refresh vẫn còn |
| 6 | Trang chi tiết: số lượng (cộng phần trong giỏ) vượt tồn kho | "Chỉ còn N phần (giỏ đã có X phần)", nút bị khóa |
| 7 | Bấm **Tiến hành đặt hàng** khi chưa đăng nhập → đăng ký | Về `/checkout`, giỏ giữ nguyên |
| 8 | Bấm **Thanh toán qua VNPAY** | Network: `POST /api/orders` 201, body chỉ có cấu hình; tổng đơn = tổng hiển thị |
| 9 | Thanh toán thất bại / hủy | Giỏ vẫn còn |
| 10 | Thanh toán thành công (PAID) | Giỏ được xóa |
| — | Suốt quá trình | **Không có request `/api/cart`** |

## 10. Kiểm thử tự động

```powershell
npm --prefix frontend test        # unit: services + store
npm --prefix frontend run lint
npm --prefix frontend run build
```

| File test | Nội dung |
|---|---|
| `frontend/src/stores/cart.test.ts` | Gộp cấu hình trùng, cấu hình khác thành dòng mới, kẹp 1–99, đổi size gộp dòng, xóa/clear, persist localStorage |
| `frontend/src/services/mock.test.ts` | Mock orders/payments/promotions/Barista (tạo đơn từ `CartItem`) |
| `frontend/src/services/api.test.ts` | Ánh xạ `apiProducts`/`apiOrders`, lỗi 409 tồn kho |
| `backend/src/products/product-detail.*.spec.ts` | Service và HTTP `GET /products/:id` |
| `frontend/e2e/flow.spec.ts`, `api-menu.spec.ts` | E2E menu → tùy chỉnh → giỏ → checkout |

Kết quả gần nhất: `docs/TESTING.md` mục 2026-10-24.

## 11. Câu hỏi thường gặp khi bảo vệ

- **Giỏ lưu ở đâu?** localStorage qua Zustand `persist`, key `brewlite-cart-v1`. Không lưu server.
- **Giỏ ở localStorage thì đặt đơn thế nào?** Checkout đọc `items` từ store và gửi trong body `POST /orders`. Backend không cần giỏ server.
- **Sửa giá trong localStorage có lừa được không?** Không. Frontend không gửi giá; backend tính lại từ catalog.
- **Thêm cùng món hai lần?** Cùng cấu hình (`itemKey`) thì cộng số lượng, khác cấu hình thì tách dòng.
- **Kiểm tồn kho ở đâu?** Client kiểm sớm (trang chi tiết + trang giỏ) cho trải nghiệm tốt; backend kiểm chính thức khi tạo đơn (409).
- **Sao không lưu giỏ theo tài khoản?** Theo thiết kế ban đầu của nhóm: đơn giản, không cần đồng bộ/gộp giỏ, không phát sinh API và bảng dữ liệu. Đổi lại giỏ không theo người dùng sang máy khác; đơn hàng vẫn lưu server và xem được ở mọi máy.
- **Khi nào giỏ bị xóa?** Người dùng bấm xóa, hoặc khi server xác nhận đơn PAID. Thanh toán thất bại thì giữ giỏ.

## 12. Giới hạn hiện tại

- Giỏ không đồng bộ giữa thiết bị/trình duyệt; xóa dữ liệu trình duyệt là mất giỏ.
- Giá trong giỏ có thể cũ nếu sản phẩm đổi giá; giá cuối cùng do backend xác nhận khi tạo đơn.
- Đăng xuất không xóa giỏ (giỏ thuộc trình duyệt, không thuộc tài khoản).
- `category` và nội dung giới thiệu trên trang chi tiết là dữ liệu tĩnh; nút **Yêu thích** chưa lưu.
- Backend `/cart` và bảng `carts/cart_items` còn trong repo nhưng không dùng; gỡ hẳn cần thống nhất với TV4/TV5.
