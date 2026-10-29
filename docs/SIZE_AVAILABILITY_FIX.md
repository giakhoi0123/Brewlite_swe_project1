# Sửa tồn khả dụng theo size — 2026-10-29

Trạng thái: **IMPLEMENTED / TESTED — READY_FOR_REVIEW**. Nhánh `main`, không commit/push/deploy. Không đổi schema, không có migration mới, không sửa dữ liệu DB ứng dụng. Owner các module giữ theo plan.

## Nguyên nhân đã xác minh

`ProductsService.findAll/findOne` trả `stock = min(Product.stock, max(sức bán các size được bán))`; API chi tiết trước đó chỉ trả boolean `available` cho từng size. Trang `products/[id]/page.tsx` đọc `product.stock` cho nhãn và phép kiểm `inCart + quantity`, trong khi component `Quantity` chỉ chặn ở 99. Vì vậy đổi size không đổi nhãn hoặc giới hạn theo công thức. Giả thuyết Math.max đúng nhưng chưa đầy đủ: còn giới hạn bổ sung Product.stock và frontend thực tế không truyền bất kỳ giới hạn tồn nào vào Quantity.

Giỏ frontend là Zustand/localStorage, không dùng `/cart`. Trước sửa, trang giỏ chỉ so số lượng theo món với stock list; chưa kiểm tra tổng nguyên liệu. Backend `/cart` cũng mới kiểm giới hạn Product.stock. Orders đã có `InventoryService.demand` cộng toàn đơn, topping × số ly; `reserve` và `reserveIngredients` dùng transaction, thứ tự ID và điều kiện version/stock. Không thay logic Orders/Payment để sửa lỗi hiển thị.

## Quy tắc dữ liệu

- `ProductRecipe` khóa `(productSizeId,ingredientId)`, `ToppingRecipe` khóa `(toppingId,ingredientId)` ngăn trùng ở DB; DTO sửa công thức cũng chặn trùng. Helper preview vẫn cộng các dòng lặp theo ingredient ID để không đánh giá dư sức bán nếu nhận dữ liệu lặp.
- Tồn và định mức đều Decimal(12,3) theo `Ingredient.unit`: G, ML hoặc PIECE; không có trường đơn vị riêng trên recipe, không có kg/lít phải quy đổi lúc đọc. Nhập kg/lít phải đổi sang g/ml trước khi lưu. Dùng Decimal chia/floor, tránh sai số float.
- Công thức rỗng, amount không hữu hạn/không dương, stock sai cho sức bán 0. Đặt hàng/kiểm tra giỏ từ chối thiếu công thức; không dùng size khác hoặc coi là vô hạn.
- `Ingredient.stock` là tồn khả dụng sau phần giữ chỗ: đặt đơn trừ ngay; hoàn/retry theo `OrderIngredientUsage` snapshot. Không trừ giữ chỗ lần hai khi tính sức bán.
- Mỗi topping chọn là một phần cho mỗi ly; mô hình hiện không có quantity riêng cho topping và cấm topping ID lặp. Topping dùng chung nguyên liệu với món được cộng cùng tổng. Đá/đường chưa ảnh hưởng công thức theo mô hình hiện có.
- Vẫn giữ giới hạn bán bổ sung Product.stock. Ví dụ 360g → 36 S/12 L cần Product.stock ≥36 và các nguyên liệu khác đủ. Nếu giới hạn bán là 8 thì cả hai size có thể bị chặn ở 8 đúng chính sách hiện hành.
- Số hiển thị là snapshot món cơ bản, chưa tính topping/giỏ, chưa giữ hàng; UI ghi rõ. Toàn giỏ được backend kiểm tra trước khi lưu thêm/tăng/đổi size và kiểm lại khi đặt đơn. Giảm/xóa cho phép sửa giỏ lỗi.

## API trước và sau

Trước, một size: `{id,code,name,extraPrice,available}`. Sau bổ sung `stock`:

```json
{
  "stock": 36,
  "defaultSizeId": "<uuid-size-S>",
  "sizes": [
    {"id":"<uuid-size-S>","code":"S","name":"Nhỏ","extraPrice":0,"available":true,"stock":36},
    {"id":"<uuid-size-M>","code":"M","name":"Vừa","extraPrice":4000,"available":true,"stock":18},
    {"id":"<uuid-size-L>","code":"L","name":"Lớn","extraPrice":9000,"available":true,"stock":12}
  ]
}
```

Ví dụ rút gọn phần availability, S/M/L lần lượt dùng 10/20/30g. `GET /products` giữ nguyên shape, `product.stock` là số tóm tắt lớn nhất trong các size, không dùng cho giới hạn size đang chọn. UUID size vẫn ổn định; payload giỏ/đơn giữ `productId` + size code theo unique key hiện có.

Mới: `POST /api/products/availability` nhận `{items:[{productId,size,toppingIds,quantity,ice,sugar,note?}]}`, trả `200 {valid:true}` hoặc 409 kèm thông báo nguyên liệu thiếu. Không cần đăng nhập, không lưu giỏ, không giữ kho. Tối đa 100 dòng; số lượng 1–99, không trùng topping; 400/404/422 theo hợp đồng validation. [API đầy đủ](API_CONTRACT.md).

## File thay đổi

| File (đường dẫn từ repo) | Mục đích |
|---|---|
| `backend/src/inventory/recipe-capacity.ts` | Cộng dòng lặp, Decimal/floor, chặn định mức/tồn lỗi |
| `backend/src/inventory/cart-availability.ts` | Kiểm tra toàn giỏ bằng demand dùng chung với Orders, gộp món/topping/nguyên liệu; dùng snapshot thấp nhất nếu relation trả khác nhau |
| `backend/src/products/products.service.ts` | Tồn từng size, thực thi preview toàn giỏ |
| `backend/src/products/product-detail.ts` | Kiểu response size thêm stock |
| `backend/src/products/products.controller.ts` | Endpoint availability và no-store |
| `backend/src/products/validate-cart.dto.ts` | DTO preview tái sử dụng validation dòng Orders |
| `backend/src/cart/cart.service.ts` | Kiểm tra nguyên liệu sau add/update, rollback nếu lỗi; transaction Serializable; GET báo invalid |
| `frontend/src/types/domain.ts` | Giữ id/stock size; stock thiếu nghĩa chưa tải, không phải 0 |
| `frontend/src/services/contracts.ts` | Interface validateCart |
| `frontend/src/services/api.ts` | Gửi toàn giỏ, giữ stock/id/default, lấy detail no-store |
| `frontend/src/services/mock.ts` | Adapter mock riêng tương thích interface; không phải kiểm chứng nguyên liệu thật |
| `frontend/src/stores/cart.ts` | Thao tác async kiểm tra trước lưu; busy/error; chống double-click và ghi đè giỏ vừa xóa |
| `frontend/src/components/ui.tsx` | Quantity nhận max/disabled, mặc định 99 cho màn khác |
| `frontend/src/app/products/[id]/page.tsx` | Nhãn/limit theo size, clamp và thông báo, hết hàng/loading/error, refresh khi bị từ chối; quick add lấy detail |
| `frontend/src/app/cart/page.tsx` | Tải detail mới và kiểm toàn giỏ; bỏ phép kiểm stock tổng gây hiểu sai; lỗi/retry và chặn checkout |
| `frontend/src/app/checkout/page.tsx` | Lỗi đặt đơn có link quay về giỏ để tải tồn mới; giữ dữ liệu giỏ |
| `backend/src/products/{size-availability,availability.http,product-detail.http}.spec.ts` | Công thức, nhiều size/topping, HTTP/DTO và tương thích API |
| `backend/src/inventory/ingredients.postgres.spec.ts` | Thêm ca DB thật S36/L12/L5, preview, stale checkout và server-cart rollback |
| `frontend/src/services/api.test.ts`, `frontend/src/stores/cart.test.ts` | Payload/size/default; gộp, thay size, shortage, race trong store |
| `frontend/e2e/size-availability.spec.ts` | UI 1440/768/390, giới hạn size, lỗi tải/stale kho, giỏ và checkout rejection |
| `docs/PROJECT_STATUS.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/API_CONTRACT.md`, tài liệu này | Kết quả, phạm vi và phần chưa kiểm chứng |

## Kiểm thử đã chạy

| Lệnh/kiểm tra | Kết quả |
|---|---|
| `npm.cmd --prefix backend run prisma:generate` | PASS; đồng bộ client từ schema có sẵn, không migrate DB |
| `npm.cmd --prefix backend run build` / `run lint` | PASS |
| `npm.cmd --prefix backend test -- --runInBand` | 29 suites / 314 tests PASS; 7 suites / 70 tests DB skipped |
| `npm.cmd --prefix frontend test` | 29/29 PASS |
| `npm.cmd --prefix frontend run build` | PASS (Webpack production) |
| Frontend `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS |
| `npm.cmd --prefix frontend run lint` | 0 errors; 1 warning có sẵn ở checkout về `normalizePromotion` |
| Playwright `size-availability.spec.ts` với Edge, frontend port 3100 | 4/4 PASS; API interception, không phải DB E2E |
| Xem ảnh detail/cart 1440/768/390, đối chiếu Stitch | Giữ bố cục/phong cách, nhãn và controls đọc được; detail kiểm tự động không tràn ngang |
| Backend full test typecheck (`tsc --noEmit --incremental false`) | Còn 3 lỗi cũ ở `src/mail/mail.service.spec.ts:50–52`, `callArg` unknown; không sửa file ngoài phạm vi |
| `npm.cmd --prefix backend run test:ingredients:postgres` | PASS sau khi bật Docker/PostgreSQL: 17 migrations, 36 suites / 384 tests, 0 skipped; DB UUID riêng đã tự dọn |

Đã đồng bộ dependency local để khắc phục thiếu nodemailer/Prisma Client cũ; không đổi package/lockfile. Sandbox Windows gây `uv_os_get_passwd` cho tsx nên unit frontend và Edge chạy qua quyền thực thi được công cụ duyệt. Không thay chính sách hệ thống.

Browser đã kiểm tra: mở mặc định S36; chọn 20 S rồi L→12 và thông báo; tăng/giảm/đổi size nhiều lần; M0 chặn mua; thêm đúng size L; thêm tiếp 34 S khi có 1 L bị từ chối; L bị nguyên liệu khác chặn còn5; kho giảm sau mở trang→409 và refresh về hết hàng; không fallback stock=999 nếu response thiếu size stock; lỗi tải hiển thị riêng. Unit/backend HTTP kiểm thêm topping, nhiều món, dòng lặp, thiếu/sai công thức, decimal và payload.

Ban đầu Docker daemon/DB chưa chạy; đã khởi động Docker Desktop và `docker compose up -d postgres`, sau đó runner chạy thành công trên DB UUID riêng và tự dọn. **Đã kiểm chứng concurrency/rollback trên PostgreSQL thật trong phạm vi bộ test**: 8 đơn ở nhiều món tranh nguyên liệu chung chỉ một đơn thành công, kho không âm; thiếu nguyên liệu/topping rollback cả đơn và Product stock; retry/release dùng snapshot; server-cart add/đổi size bị từ chối không lưu mutation. Code Orders có CAS `WHERE id/version/stock>=amount`, cập nhật kho + snapshot + đơn trong một transaction, lock theo ID. Không khẳng định an toàn tuyệt đối với mọi writer/mọi điều kiện production. Chưa chạy browser nối DB thật; browser dùng interception và backend HTTP/DB được kiểm độc lập. PostgreSQL repo đang chạy, dữ liệu ứng dụng không bị migrate/reset/seed trong lượt này.

## Chạy lại và kiểm tra thủ công

1. Bật PostgreSQL/Docker của repo, xác minh đúng DB, chạy migration nền đang có theo README nếu DB chưa cập nhật. Bản sửa này không có migration mới; không reset/seed đè dữ liệu đang dùng.
2. Chạy `npm.cmd --prefix backend run test:ingredients:postgres`. Runner tạo DB tên UUID riêng, migrate, chạy bộ test và tự dọn; không seed vào DB ứng dụng. Bộ này đã PASS trong lượt sửa; dùng lệnh trên để chạy lại rollback/race và các ca mới.
3. Trên dữ liệu QA riêng: nguyên liệu cà phê đơn vị G, stock360; công thức S10/M20/L30; Product.stock≥36. Mọi nguyên liệu khác đủ. Mở `/products/<product-id>` ở API mode, chọn S→36/L→12; tăng S lên20 rồi đổi L→12; plus bị vô hiệu ở12.
4. Cho nguyên liệu thứ hai của L chỉ đủ5: tải lại và chọn L→5. Cho cà phê về0→Hết hàng, không tăng/thêm. Thử ngắt API→lỗi tải với nút thử lại, không báo nhầm hết hàng.
5. Với kho360: thêm20S rồi6L phải bị từ chối (380g), kể cả chia nhiều dòng/món. Topping espresso10g/ly: 12L+topping phải bị từ chối (480g), 9L+topping vừa360g nếu nguyên liệu khác đủ. Giảm/xóa để sửa giỏ và thử đổi size trong giỏ.
6. Mở chi tiết/checkout rồi dùng phiên QA khác tiêu thụ nguyên liệu; thao tác mua/đặt lại phải nhận409 rõ nguyên liệu thiếu. Chi tiết tải tồn mới; checkout giữ giỏ và link «Kiểm tra lại giỏ và tồn khả dụng» tải lại kiểm tra giỏ. Kiểm tra menu và màn khác vẫn nhận `product.stock` như cũ.

Chạy browser fixture (không cần DB) sau frontend production build/start:

```powershell
npm.cmd --prefix frontend run start -- --port 3100
# Terminal khác:
$env:BREWLITE_E2E_BASE_URL='http://localhost:3100'
$env:BREWLITE_E2E_BROWSER_CHANNEL='msedge'
npm.cmd --prefix frontend run test:e2e -- size-availability.spec.ts
```

Ảnh QA nằm trong `frontend/test-results/size-detail-{1440,768,390}.png` và `size-cart-{1440,768,390}.png` (Git ignore).
