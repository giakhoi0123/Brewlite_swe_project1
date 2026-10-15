# Kiểm chứng TV4 — 2026-10-15

## Kết quả mới nhất: sửa checkout HTTP 500

Log runtime chỉ ra `PrismaClientValidationError: Unknown argument history`: schema dùng `statusHistory` nhưng create order gửi `history`. Service đã đồng bộ tên và kiểm tra tĩnh input bằng `satisfies Prisma.OrderUncheckedCreateInput`. Không thay schema SQL, không cần migration mới.

Đã chạy `docker compose build backend` và `docker compose run --rm --no-deps --entrypoint node backend scripts/verify-orders-postgres.cjs`: **14 suites, 146 tests PASS, 0 skipped**. Có 8 test PostgreSQL thật: 7 kịch bản concurrency/rollback trước đó và regression HTTP dùng Nest/JWT/Origin/Prisma thật, POST đơn L+topping 45.000đ nhận 201/PENDING, lưu một statusHistory, trừ stock và GET status thành công. Build local và lint backend cũng qua.

Script tạo database `brewlite_orders_test_<uuid>` riêng trên PostgreSQL Compose, apply đủ 5 migrations, chạy tests rồi chỉ xóa database vừa tạo. Database tạm đã được dọn sau lần chạy thành công; không dùng dữ liệu ứng dụng làm fixture. Script cần tài khoản DB local có quyền CREATE DATABASE. Có thể tái chạy bằng hai lệnh Docker ở trên khi PostgreSQL đang chạy.

Đã cập nhật container local bằng `docker compose up -d --no-deps backend`. Browser checkout cần người dùng thử lại; Payment chưa thuộc phần backend TV4. Các kết quả skipped/DB chưa chạy dưới đây là lịch sử trước khi sửa lỗi.

## Lịch sử kiểm chứng trước khi PostgreSQL sẵn sàng

Phạm vi T06, 10A, 10C trên `feature/orders-and-inventory`. Không đánh dấu VERIFIED_COMPLETE vì PostgreSQL/backend/browser thật chưa chạy trong phiên này. Các phần kiểm thử trước mốc này bên dưới giữ nguyên làm lịch sử.

| Kiểm tra | Kết quả phiên TV4 |
|---|---|
| `npm --prefix backend run prisma:generate` | PASS Prisma Client 6.19.3 |
| Prisma validate (nạp `.env` bằng Node) | PASS |
| Backend build/lint | PASS |
| Backend Jest | 138 passed, 7 skipped (PostgreSQL) |
| Frontend build/lint | PASS |
| Frontend tests | 8 passed: 5 REST adapter + 3 mock hiện có |
| PostgreSQL connection | `localhost:5434/brewlite`: ECONNREFUSED; không có Docker CLI |
| Prisma migrate status | Exit 1, schema engine error; chưa apply migration |
| PostgreSQL concurrency/rollback suite | SKIPPED, chưa đặt `ORDERS_TEST_DATABASE_URL` |
| Browser checkout → Orders DB thật | Chưa chạy do backend/DB chưa sẵn sàng |
| Typecheck toàn bộ backend tests (`tsc --noEmit -p tsconfig.test.json`) | Còn lỗi fixture Products có sẵn: products.http.spec.ts thiếu stock/description; test/fixtures/product-detail.ts thiếu stock. Không đổi phần owner TV2. Các lỗi này không chặn build ứng dụng/Jest. |

`orders.http.spec.ts` chạy routing/ValidationPipe/JWT/RolesGuard/Origin middleware/OrdersService thật với Prisma test double, **không phải bằng chứng DB**. Kiểm tra POST PENDING, giá backend, payload rỗng/sai/field chèn thêm, thiếu auth, role sai, Origin sai, ownership, JSON status và 409 khi inventory CAS thua. `order-state-machine.spec.ts` kiểm tra toàn bộ 49 cặp trạng thái. Inventory unit test giả lập hai request dùng cùng version tranh sản phẩm cuối; service test kiểm tra snapshot, aggregate qty, bounds tiền, release, retry, CAS và history. REST adapter tests xác nhận credentials include, chỉ gửi cấu hình món, không gửi owner/giá/discount, lỗi 400/409/network không fallback, và các URL staff/history/status.

Lệnh PowerShell từ repo (script Jest đã sửa để chạy cả Windows/POSIX):

```powershell
npm.cmd --prefix backend test -- --runInBand
npm.cmd --prefix backend run build
npm.cmd --prefix backend run lint
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run lint
```

Frontend `npm ci` cần truy cập npm registry; test tsx trên máy này cần chạy ngoài sandbox vì `uv_os_get_passwd` lỗi trong sandbox. Build/lint đã chạy trong sandbox. Cảnh báo Next nhiều lockfile có từ `package-lock.json` root chưa được track trước phiên; file đó được giữ nguyên.

Migration `backend/prisma/migrations/20261015000100_orders_inventory/migration.sql` được tạo offline bằng Prisma migrate diff từ schema HEAD sang schema mới, bổ sung CHECK giá/qty/version. Khi DB của repo sẵn sàng, kiểm tra đúng host/database rồi chạy (không dùng DB repo khác):

```powershell
Set-Location backend
node --env-file=../.env node_modules/prisma/build/index.js validate
node --env-file=../.env node_modules/prisma/build/index.js migrate deploy
npm.cmd run prisma:generate
Set-Location ..
```

Bộ DB test cần **database kiểm thử riêng đã tạo**, không tự fallback về DATABASE_URL; không dùng database demo/chung cho test này. Từ repo:

```powershell
$env:ORDERS_TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5434/brewlite_orders_test?schema=public'
$env:DATABASE_URL = $env:ORDERS_TEST_DATABASE_URL
npm.cmd --prefix backend run prisma:migrate
npm.cmd --prefix backend test -- --runInBand orders.postgres.spec.ts
Remove-Item Env:ORDERS_TEST_DATABASE_URL
Remove-Item Env:DATABASE_URL
```

Thay URL mẫu bằng DB kiểm thử có thật. Suite tạo UUID riêng và chỉ dọn fixtures theo các ID đó, không reset/truncate/seed DB. Bảy kịch bản: 8 request tranh 1 tồn kho; rollback decrement món đầu khi món sau hết hàng; rollback khi ghi Order lỗi FK; hủy đồng thời chỉ release một lần; failed/retry hết kho và vòng đời đến COMPLETED; rollback state/history/kho khi transaction payment thất bại; snapshot không đổi khi catalog đổi. Chỉ đánh dấu DB PASS sau khi suite thật sự chạy (không skipped).

Kiểm tra browser khi backend đã migrate: bật `NEXT_PUBLIC_DATA_MODE=api`, restart frontend; đăng nhập CUSTOMER, chọn size+topping, checkout; xác minh POST 201 PENDING và GET `/orders/me`, `/orders/:id`, `/orders/:id/status`. Thử hết kho để nhận lỗi 409 và giữ giỏ. Dùng BARISTA kiểm tra GET/PATCH staff; PAID để thử luồng staff phải đến từ tích hợp payment TV5 hoặc fixture kiểm thử, không thêm endpoint tự đánh dấu PAID. Payments/Promotions/Loyalty chưa có backend nên không dùng kết quả payment demo làm bằng chứng T08/10B/10D.

---

# Kiểm thử

Sau khi hợp nhất `origin/main` vào `feature/auth-and-base` để giải quyết PR #8: `docker compose build backend` PASS (gồm Prisma Client generate và Nest build); `docker compose run --rm --no-deps --entrypoint npm backend test -- --runInBand` PASS 13 suites, 57/57 tests. Không chạy migration hay Payment API E2E trong lượt này.

Ngày 2026-10-15, sửa CORS cho frontend cổng 3002: `docker compose up -d --build backend` PASS; backend build PASS; `docker compose exec -T backend npm test -- --runInBand` PASS 38/38. Preflight `POST /api/auth/register` từ origin 3000 và 3002 đều trả 204 với `Access-Control-Allow-Origin` tương ứng và credentials; origin 3003 không được phép. POST đăng ký với payload rỗng từ origin 3002 trả HTTP 400 kèm CORS header đúng, xác nhận trình duyệt nhận được lỗi API. Chưa tạo tài khoản thử mới trong lượt kiểm tra này.

Lượt đồng bộ `origin/main` vào `feature/payments` (2026-10-15, local):
- Prisma Client generate PASS với schema chứa đồng thời Cart và Payment.
- Frontend unit PASS 7/7 và production build PASS.
- Backend Jest PASS 13 suites, 56/56 tests; Nest build PASS.
- Chưa chạy migration Payment/API E2E vì OrdersModule và `PAYMENT_ORDER_PORT` chưa có.

Lượt giỏ hàng server (2026-10-15, Windows, PostgreSQL Compose cổng 5434):
- Backend `npm run build`, `npm run lint` PASS; `jest --runInBand` PASS 48/48 (37 cũ + 11 cart: tính giá, gộp cấu hình, validate, tồn kho, đổi size/gộp, riêng tư theo user, merge giỏ khách).
- `prisma migrate deploy` áp dụng `20261015000000_add_cart`; `prisma migrate diff` không còn drift; 10 sản phẩm giữ nguyên.
- Smoke HTTP backend thật + PostgreSQL: 12/12 (401 khi chưa đăng nhập, giá server, gộp, đổi size, 409 tồn kho, 400 khi client gửi giá, merge, xóa, CSRF 403).
- Frontend `tsc`, `lint`, `build` PASS; `npm test` PASS 4/4 (thêm mock cart).
- Trình duyệt Edge, frontend API mode: khách thêm món → đăng ký → giỏ gộp lên server → tăng số lượng, đổi size L (giá UI = giá server) → xóa localStorage + reload vẫn còn → đăng xuất badge 0 → đăng nhập lại 3 món, không nhân đôi → xóa tất cả: 8/8 PASS.
- Playwright (kênh `msedge` vì máy chưa cài Chromium của Playwright): mock 3/3 PASS, API mode 2/2 PASS.

Lượt Payment TV5 hiện tại:
- Frontend `npm --prefix frontend run test`: PASS 6/6, gồm 3 test payment-intent mới; lint và production build PASS.
- Backend Prisma Client generate và schema validate PASS với URL cú pháp giả, không kết nối DB.
- Backend build/lint PASS; Jest chạy từ `backend/jest.config.ts`: PASS 11 suites, 45/45 tests, gồm Payment service và HTTP contract.
- Script test backend đã đổi sang `node --experimental-vm-modules ... --config jest.config.ts` để chạy được trên Windows/Unix; `npm --prefix backend test -- --runInBand` PASS.
- Chưa migrate/chạy HTTP Payment với PostgreSQL vì OrdersModule/bảng Order của TV4 chưa có; PaymentsModule chưa được đăng ký vào AppModule.

Sau lượt chỉnh UI theo Stitch: `npm --prefix frontend run build` PASS (13 route), `npm --prefix frontend run lint` PASS, `npm --prefix frontend run test` PASS 3/3. Playwright chụp trang chủ, login, chi tiết sản phẩm và giỏ hàng ở desktop 1440 px/mobile 390 px; thêm món vào giỏ thành công và các màn được kiểm tra không tràn ngang. Chưa chạy lại bộ E2E auth đầy đủ trong lượt này vì backend không khởi động.

Đã chạy trong phiên triển khai:
- `npm run build` ở frontend: PASS, 13 route tạo thành công.
- `npx prisma generate && npm run build && npm test -- --runInBand` ở backend: PASS build, 37/37 tests.
- `npm run lint` backend: PASS.
- `npm run lint` frontend: PASS, không có cảnh báo.
- `npm test` frontend: 3/3 tests qua (giá, order/payment idempotency, failure/unknown, loyalty, promotion, Barista state).
- `docker compose config --quiet`: PASS sau khi tạo `.env` local (đã ignore).
- Next production server cổng 3100: 10 route (menu, cart, auth, checkout, orders, profile, Barista, dynamic detail/result) đều HTTP 200.
- `docker compose up -d --build backend frontend`: PASS, 3 container chạy; DB healthy.
- `npm run db:migrate`, `npm run db:seed`: PASS sau khi `source .env`; 4 migrations và 10 sản phẩm seed.
- `python3 scripts/smoke_http.py`: PASS với backend Compose/PostgreSQL: Products list/detail, auth validation/duplicate/cookie/login/logout, CSRF, CUSTOMER 403, BARISTA 200.
- Kiểm tra bcrypt trực tiếp trong DB: PASS, hash khác plaintext và `bcrypt.compare` đúng.
- ProductService REST adapter đọc DB: PASS, 10 món và chi tiết S/M/L/stock.
- HTTP Compose: frontend `/`, `/cart`, `/login` trả 200; backend `/api/products` trả 200 và 10 món; preflight CORS 204 đúng origin/credentials.

- `npm --prefix frontend run test:e2e -- --grep-invert "API mode"`: PASS 3/3 Chromium E2E: menu/tùy chỉnh, giỏ persistence/quantity/remove/clear, auth redirect/đăng ký, promo sai/đúng, Card fail/retry/success, order timeline, loyalty, Barista PAID→COMPLETED, mobile search/hết hàng/UNKNOWN.
- `BREWLITE_RUN_API_E2E=1 npm --prefix frontend run test:e2e -- --grep "API mode"`: PASS 2/2 Chromium E2E khi Next chạy API mode trên origin 3000: 10 sản phẩm từ PostgreSQL, S/M/L, topping, giá động, loading/empty/error/retry.

Orders API thật chưa có; Payment core đã có nhưng endpoint chưa thể bật nếu thiếu Orders port. Task 07/08/09/10 chưa thể VERIFIED_COMPLETE toàn bộ. `npm ci` backend báo 29 lỗ hổng audit (2 low, 21 moderate, 5 high, 1 critical); cần rà soát riêng trước production, không chạy `audit fix --force` tự động.
