# Kiểm chứng giỏ Zustand — 2026-10-24 (Windows, Docker PostgreSQL 5434)

- `npm --prefix frontend test`: **23/23 PASS** (thêm `src/stores/cart.test.ts` 4 test: gộp cấu hình, kẹp 1–99, đổi size gộp dòng, xóa/clear/persist; bỏ test `mockCart`). `npm --prefix frontend run lint` và `run build` PASS.
- `npm run db:migrate` áp dụng các migration còn pending lên database ứng dụng local; seed idempotent.
- Script Playwright (Edge) trên backend + frontend `NEXT_PUBLIC_DATA_MODE=api`, Auth/Products/Orders/PostgreSQL thật, chặn `/api/payments` để dừng ở PENDING: **16/16 PASS** — khách thêm món, cùng cấu hình gộp, khác đá thành dòng mới, đổi size, tăng số lượng, xóa dòng, reload còn giỏ, 1440/768/390 không tràn (giỏ + chi tiết), đăng ký từ giỏ không mất giỏ, `POST /orders` 201 PENDING, body chỉ có cấu hình (không giá), tổng server = tổng UI, giỏ còn khi chưa PAID, **0 request `/api/cart`**.
- `playwright test api-menu` (API mode): 2/2 PASS.

## Hồi quy toàn module sau khi đổi giỏ (2026-10-24)

Database kiểm thử riêng `brewlite_e2e_<timestamp>` trong container (migrate + seed, xóa sau khi chạy); không đụng database ứng dụng. Edge, backend trỏ vào DB kiểm thử.

| Lớp | Kết quả |
|---|---|
| Frontend unit / lint / build | 23/23 PASS, lint sạch, build PASS |
| Backend build / lint / Jest | PASS; Jest 20 suite/253 test PASS (38 test DB opt-in skip), bằng mốc trước khi đổi; lint chỉ có 3 warning cũ (loyalty/orders) |
| API mode: `api-menu` (Products) | 2/2 PASS |
| API mode: `auth-presentation` | 3/3 PASS |
| API mode: `auth-session-api` | PASS khi chạy riêng; FAIL khi chạy sau `auth-presentation` (link "Đăng nhập" khớp 3 phần tử) — **lỗi có sẵn**, tái hiện y hệt trên code gốc (stash) |
| API mode: `orders-api` (Orders/Inventory) | 4/4 PASS sau khi cập nhật test: thay kiểm tra bảng `cart_items` bằng kiểm tra giỏ localStorage, sửa tên nút cũ "Xác nhận thanh toán" → "Thanh toán qua VNPAY" (đổi từ commit VNPAY `59103dd`, test chưa cập nhật) |
| API mode: script giỏ Zustand | 16/16 PASS |
| Mock mode: `flow.spec` | 2/5 PASS (cart remove/clear; mobile checkout). 3 FAIL **giống hệt trên code gốc**: dòng 24 mở UUID sản phẩm seed trong mock; dòng 105/153 `getByLabel('Mật khẩu')` khớp 2 phần tử (nút hiện/ẩn mật khẩu). Bài VNPAY success vẫn qua bước "Giỏ hàng 0 món" sau PAID trước khi lỗi ở đăng nhập Barista |

Kết luận: đổi giỏ sang Zustand không làm hỏng Products, Auth, Orders/Inventory, Payment mock (xóa giỏ sau PAID) và Loyalty (11 điểm sau đơn); các lỗi còn lại tồn tại trước thay đổi và thuộc test Auth/flow. Barista không đọc giỏ, nhưng E2E Barista chưa kiểm chứng được vì bị chặn ở bước đăng nhập (lỗi selector có sẵn).

---

# Kiểm chứng sau khi nhập `origin/main` — 2026-10-22

- Prisma generate/validate, backend build và lint: PASS. Backend unit/integration không cần DB: **20 suite/253 test PASS**; backend E2E: **6 suite/126 test PASS**, 36 test DB opt-in skip đúng cấu hình.
- Frontend: **20/20 unit PASS**, full lint PASS và production build PASS.
- `npm --prefix backend run test:payments:postgres`: tạo database `brewlite_payments_test_<uuid>` riêng, áp đủ **13 migration**, PASS **7 suite/101 test**, rồi xóa database tạm. Không reset/truncate database ứng dụng.
- Lượt PostgreSQL đầu bắt lỗi tích điểm hai lần khi VNPAY finalize `PAID`; sau khi bỏ increment trùng ở Payment adapter, lượt chạy lại PASS. Orders giữ ownership phép cộng điểm; Payment transaction vẫn ghi `LoyaltyLog` và xóa giỏ.
- `docker compose config --quiet`: PASS; PostgreSQL/backend/frontend đang chạy, PostgreSQL healthy.
- `prisma migrate status` trên database ứng dụng local: không có checksum drift, nhưng còn ba migration pending (`payment_consistency`, `loyalty_log`, `vnpay_consistency_compat`). Lượt này không áp dụng migration lên database ứng dụng; cần chạy `npm run db:migrate` trước khi dùng code sau merge.
- Blocker còn lại: chưa cấu hình/xác nhận callback IPN HTTPS thật trong portal VNPAY, nên T08 vẫn IN_PROGRESS.

---

# Kiểm chứng VNPAY TEST trước merge — 2026-10-22

- Prisma generate/validate: PASS với migration `20261021000000_vnpay_gateway`.
- Backend build/lint: PASS. `npm test -- --runInBand`: **18 suite / 191 test PASS**, 2 suite/11 test PostgreSQL skip vì chưa cấu hình `PAYMENTS_TEST_DATABASE_URL` trỏ tới database test tách biệt.
- Frontend: **19/19 unit PASS**, `tsc --noEmit` PASS, production build PASS, lint các file checkout/payment/service/E2E liên quan PASS.
- Full frontend lint còn một lỗi có sẵn ngoài phạm vi tại `frontend/src/app/profile/page.tsx:21` (`react-hooks/preserve-manual-memoization`); file này không bị sửa trong lượt VNPAY.
- Browser QA mock chỉ dùng để kiểm bố cục: checkout tại 1440/768/390 không tràn ngang, có đúng một radio VNPAY-QR, không có selector kết quả demo/Ví/Thẻ. Đây không phải bằng chứng giao dịch VNPAY.
- `docker compose config --quiet`: PASS. Compose đang chạy đủ PostgreSQL/backend/frontend; PostgreSQL healthy, backend HTTP 200 và migration `20261021000000_vnpay_gateway` đã được áp dụng thành công.
- Thử hosted Sandbox ngày 2026-10-22 ban đầu nhận “Ngân hàng thanh toán không được hỗ trợ” khi ép `vnp_BankCode=VNPAYQR`. Bộ phận kỹ thuật VNPAY sau đó xác nhận đã active QR cho terminal TEST; `.env` local đã đặt `VNPAY_BANK_CODE=VNPAYQR`, backend đã recreate, và kiểm tra URL ký trả `bankCode=VNPAYQR`, `command=pay`, `version=2.1.0`, có secure hash.
- Sau khi Sandbox hiển thị QR, quét bằng ứng dụng ngân hàng LIVE có thể nhận “QR không tồn tại” do TEST/LIVE tách biệt. VNPAY đã cấp ứng dụng QR TEST iOS/Android và công cụ VSM Sandbox qua email. Bước E2E còn lại: cấu hình IPN HTTPS trong VSM, dùng app/NCB TEST hoàn tất giao dịch mới và xác nhận IPN làm DB chuyển `PROCESSING → PAID`; không ghi credential công cụ vào repo/log.
- Contract/UI: Return mã không thành công chuyển `/payment/:id/unknown` và không mutate; `resumeOrder` replay đúng idempotency key/Payment PROCESSING, không tăng số Order/Payment; chỉ `PAYMENT_FAILED` đã được IPN/QueryDR chốt mới dùng `retryOrder` với key mới và tạo attempt mới trên cùng Order. Frontend gọi owner-auth `POST /payments/:orderId/reconcile` một lần khi vào `verifying` và gọi lại khi bấm “Kiểm tra trạng thái đơn”.
- QueryDR Sandbox + DB PASS: thanh toán bằng tài khoản TEST `NGUYEN VAN A` cho Order `66e28a10-a95e-45ee-b877-a1617e9c3abf` được response QueryDR có chữ ký xác minh. Truy vấn PostgreSQL trả `Payment.status=PAID`, `Order.status=PAID`, `vnp_transaction_no=15711511`, `vnp_bank_code=NCB`, `vnp_pay_date=20261022114118`, `idempotency_key=3998d99e-ff66-4ee6-a204-0a22cc35b60c`, response/transaction status đều `00`.
- Regression an toàn trạng thái PASS: IPN/QueryDR không finalize các mã chưa hoàn tất, đảo giao dịch, nghi ngờ gian lận hoặc lifecycle `10/20`; response IPN `07` không mở retry dù transaction status là `02`. QueryDR có chữ ký với `02/08/11` mới chốt thất bại, ngăn URL hết hạn mắc kẹt nhưng vẫn tránh nguy cơ thu tiền hai lần ở mã mơ hồ.
- T08 vẫn IN_PROGRESS: QueryDR đã chứng minh fallback và persistence, nhưng IPN trong portal chưa được cấu hình nên callback IPN HTTPS E2E chưa được xác nhận. Không dùng Return hoặc QueryDR thành công để tuyên bố IPN đã chạy.

---

# Kiểm chứng tích hợp `origin/main` vào `feature/auth-and-base` — 2026-10-16

Sau fetch/merge main có Orders/Inventory, backend build lần đầu PASS nhưng full PostgreSQL suite có **24 lỗi HTTP Orders**: fixture user của TV4 thiếu `sessionVersion` nên JwtStrategy TV1 trả 401. Đã thêm version 0 vào fixture và JWT test. Chạy lại bằng `docker compose run --rm --no-deps --entrypoint node backend scripts/verify-orders-postgres.cjs`: **18 suites, 168/168 tests PASS**, không skipped. Script tạo database `brewlite_orders_test_<uuid>` riêng, áp dụng đủ 8 migrations (gồm Orders và Auth session_version), rồi xóa đúng database tạm. Không thay đổi DB ứng dụng. Backend Docker build PASS; frontend build/lint PASS; `npm --prefix frontend test`: 13/13 PASS. Browser Orders/Staff API E2E chưa chạy; Playwright demo 4/4 là bằng chứng **trước merge** và dùng mock nghiệp vụ.

Staff API sau merge chỉ có GET list và PATCH status. Frontend API mode chưa bật nút hủy có lý do, hiển thị rõ lịch sử/KPI hoàn tất còn chờ; mock mode vẫn có đầy đủ luồng. TV4 cần GET detail, PATCH cancel có reason, trả terminal history và `completedAt`. Payment/Promotion/Loyalty API còn chờ TV5/TV6.

---

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

## Lượt TV1 2026-10-16 — kết quả hiện hành

Môi trường: Docker Compose PostgreSQL; database QA riêng `brewlite_auth_test` đã áp dụng đủ 7 migration và seed Barista/products; NestJS QA cổng 3005, Next production QA cổng 3006, `NEXT_PUBLIC_DATA_MODE=mock`, Auth luôn gọi DB thật. Không xóa hoặc reset database phát triển.

| Nhóm / ca | Mong đợi | Kết quả thực tế | Trạng thái | Mã liên quan |
|---|---|---|---|---|
| Đăng ký: hợp lệ, email chuẩn hóa/trùng, thiếu/sai email/mật khẩu, role lạ | 201 CUSTOMER hoặc 400/409; hash không lộ | Jest Auth + HTTP DB đúng mã; role BARISTA từ public bị từ chối | PASS | `backend/src/auth/auth.rbac.spec.ts`, `auth.service.ts` |
| Đăng nhập: đúng/sai/không tồn tại, JWT identity, payload sai | Đúng tạo cookie; sai 400/401 | Jest PASS; E2E login và redirect PASS | PASS | `auth.rbac.spec.ts`, `frontend/e2e/flow.spec.ts` |
| JWT: thiếu, hết hạn, sửa payload, sai chữ ký, role giả | 401/403; role lấy từ DB | Jest PASS | PASS | `auth.rbac.spec.ts`, `jwt.strategy.ts` |
| Phiên: refresh, logout, dùng lại cookie cũ | Khôi phục phiên hợp lệ; token cũ 401 sau logout | Jest PASS; smoke HTTP DB thật PASS; E2E logout/role PASS | PASS | `auth.rbac.spec.ts`, `scripts/smoke_http.py`, `auth-provider.tsx` |
| CSRF/CORS/cookie và phản hồi riêng tư | Chỉ origin cấu hình, cookie HttpOnly/Lax/Secure theo môi trường, response auth no-store | CSRF Jest PASS; CORS HTTP đã kiểm tra ở lượt trước; Jest Auth xác nhận no-store trên register/login/me | PASS | `csrf.middleware.spec.ts`, `auth.controller.ts`, `auth.rbac.spec.ts` |
| Staff seed | Tạo BARISTA, hash, idempotent | Seed chạy trong DB QA; test source seed trước đây có | PASS cho chạy seed; test idempotency tự động chưa bổ sung | `backend/prisma/seed.ts` |
| Backend toàn bộ | Không lỗi | `docker compose run --rm --no-deps --entrypoint npm backend test -- --runInBand`: 13 suites, 59/59 | PASS | `backend/src/**/*.spec.ts` |
| Frontend unit | Mock cart/order/payment/Barista đúng trạng thái | `npm --prefix frontend test`: 8/8 | PASS | `frontend/src/services/*.test.ts` |
| Frontend E2E demo | Đặt hàng, retry, loyalty, staff, hủy, mobile | `BREWLITE_E2E_BASE_URL=http://localhost:3006 npm --prefix frontend run test:e2e -- --grep-invert 'API mode'`: 4/4 | PASS | `frontend/e2e/flow.spec.ts` |
| Barista KPI sau bàn giao | COMPLETED ghi thời gian thực và KPI hôm nay tăng | E2E luồng customer→Barista chạy lại sau thay đổi: 1/1 PASS, thẻ “Đã giao hôm nay” hiển thị 1 | PASS | `frontend/e2e/flow.spec.ts`, `frontend/src/services/mock.ts` |
| Staff real API, Orders ownership, Payment real, Loyalty real | Backend cấp endpoint và xác nhận guard/ownership | TV4–TV6 chưa cung cấp; không có phép thử thật | SKIPPED — BACKEND_PENDING | `docs/API_CONTRACT.md` |

Build/lint: Docker backend image build PASS (gồm Prisma generate và Nest build); frontend `npm run build` PASS (TypeScript, 13 static route + dynamic route), `npm run lint` PASS không cảnh báo. `npm --prefix frontend test` 8/8 PASS. Responsive browser QA: Barista dashboard/orders/preparing/ready/history tại 1440/768/390 không tràn; home, detail, login, register, orders, order detail, profile, cart, checkout và payment failure tại 1440/768/390 không tràn sau sửa header 768. Ảnh QA lưu tạm trong `/tmp/brewlite-*.png` (không commit). Đã nhìn và so ảnh Barista, profile, cart với Stitch. E2E hành vi các màn này PASS.

Giới hạn bảo mật cần theo dõi: chưa có rate limit login; logout vô hiệu hóa **mọi** JWT phiên của user, không quản lý từng thiết bị; test order ownership thực chờ Orders API. Các kết quả cũ bên dưới là lịch sử, không phải test count hiện hành.

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

---

## Payment–Order integration — 2026-10-17

Đã nối `PaymentsModule` với `OrdersService`, thêm foreign key `payments.order_id → orders.id`, và đưa finalize Payment + chuyển trạng thái Order/history/tồn kho/điểm vào cùng transaction. Replay idempotency không gọi gateway hoặc transition lần hai. Retry từ PAYMENT_FAILED chỉ giữ lại tồn kho và chuyển PENDING→PAID trong transaction finalize khi gateway trả PAID; PAYMENT_FAILED/UNKNOWN lặp lại giữ nguyên Order thất bại.

- `npm --prefix backend run prisma:generate`: PASS.
- `npm --prefix backend run build`: PASS.
- `npm --prefix backend run lint`: PASS.
- `npm --prefix backend test -- --runInBand`: PASS 18 suites/165 tests cho bộ không cần DB; 2 suite PostgreSQL opt-in được chạy riêng.
- Khởi tạo PostgreSQL 18 test riêng tại cổng 55434, áp đủ 9 migration và seed products/Barista: PASS.
- `backend/src/payments/payments.postgres.spec.ts` cùng `payment-status.postgres.spec.ts`: PASS 2 suite/18 test cho PAID persistence + replay, PAYMENT_FAILED→retry PAID + tồn kho, foreign key và adapter trạng thái/ownership.
- HTTP smoke với cookie/Origin thật: đăng ký customer, tạo Order, POST Payment, GET Order đều thành công. Truy vấn DB cho order smoke trả `PAID|PAID|29000|2` tương ứng Order status, Payment status, amount và số status history.
- Khôi phục “Kịch bản demo” trong API mode bằng hai cờ sandbox. Backend API thật xác nhận `PAYMENT_FAILED`, retry `PAID`, và Payment `UNKNOWN` trong khi Order giữ `PENDING`; dữ liệu vẫn ghi PostgreSQL.
- Backend build/lint và 13 Payment unit tests PASS; frontend 14/14 unit PASS và production build PASS. Browser headless xác nhận selector hiển thị cùng ghi chú PostgreSQL ở 1440/768/390, mobile `scrollWidth=innerWidth=390`; luồng API mode chọn PAYMENT_FAILED → màn thất bại → retry PAID → màn thành công PASS.
- Sau sửa luồng retry, Playwright riêng `failed payment retry returns to checkout and reuses the order` PASS: nút retry quay về checkout, hiện cảnh báo không tạo đơn mới, chọn lại outcome rồi thành công với cùng ID; kiểm tra 1440/768/390 không tràn ngang. Truy vấn PostgreSQL của order mới nhất trả một Order `PAID`, tổng 33.000 VND và đúng hai Payment `PAYMENT_FAILED → PAID`. Frontend unit 14/14, lint hai file thay đổi và production build PASS; lint toàn frontend còn bị chặn bởi lỗi memoization có sẵn tại `src/app/profile/page.tsx:21`.
- Sửa Order response trả phương thức của Payment PAID mới nhất: backend build PASS, Orders/Payments không-DB 6 suites/105 tests PASS, PostgreSQL Payment 2 suite/18 test PASS và kiểm tra `GET /orders/:id` có `paymentMethod:CARD`. Playwright retry PASS sau khi reload trang success và xác nhận “Phương thức: Ví điện tử”.

Chạy lại trên database kiểm thử riêng đã migrate:

```powershell
$env:DATABASE_URL='postgresql://USER:PASSWORD@localhost:5434/brewlite_payments_test?schema=public'
npm run db:migrate
$env:PAYMENTS_TEST_DATABASE_URL=$env:DATABASE_URL
npm --prefix backend test -- --runInBand src/payments/payments.postgres.spec.ts
```

Không trỏ hai biến trên vào database demo/chung vì suite tạo và xóa fixture của riêng nó nhưng migration vẫn thay đổi schema. T08 giữ IN_PROGRESS cho đến khi browser API E2E đầy đủ và QA thủ công hoàn tất.


## Lịch sử riêng nhánh TV4 trước khi nhập main ngày 2026-10-26

Các bằng chứng dưới đây thuộc code và gateway mock ở thời điểm ghi nhận, không xác nhận phiên bản VNPAY hiện tại.

## TV4 nghiệm thu theo báo cáo hoàn chỉnh — 2026-10-18

**25 suites / 272 tests PASS, 0 skipped**, bật đầy đủ suite PostgreSQL trên database UUID riêng, đủ 11 migrations, tự dọn sau test. Hai bài mới trong `staff-orders.postgres.spec.ts` xác minh hai CUSTOMER tranh stock=1 qua HTTP và xác nhận COMPLETED đồng thời chỉ ghi một timestamp/history. Backend build local/Docker, lint và full TypeScript check PASS.

`node backend/scripts/verify-tv4-browser.cjs`: build frontend Webpack/API mode, backend thật, hai BrowserContext login thật, checkout + gateway Payment mô phỏng → queue PAID → PREPARING → READY → COMPLETED; khách refresh kiểm tra từng trạng thái. **PASS tại 1440/768/390**. Hủy/terminal history/detail kiểm bằng cookie hai phiên qua API thật; không nhận là UI hủy/lịch sử đã chạy. DB riêng tự dọn, không thay DB ứng dụng. [Hướng dẫn, ma trận và ảnh/log](TV4_ACCEPTANCE.md).

Lượt xác minh trước commit/push: chạy lại đầy đủ backend và browser trên, frontend service tests **14/14 PASS**, frontend build cấu hình local PASS. `npm.cmd --prefix frontend run lint` **FAIL 1 lỗi** `react-hooks/preserve-manual-memoization` ở `src/app/profile/page.tsx:21`, giống `origin/main`, không nằm trong diff TV4. Backend lint/full typecheck PASS. Runner browser ghi chung stdout/stderr an toàn và đối chiếu lịch sử theo `version`.

## Backend Barista TV4 — bằng chứng trước khi nhập main

Commit `abd7343`: Prisma generate, backend build local/Docker và lint PASS; `verify-orders-postgres.cjs` chạy **19 suites/191 tests PASS, 0 skipped**, gồm 22 bài PostgreSQL và 9 migrations trên database UUID riêng đã dọn. Kiểm tra detail/role, hủy PENDING/PAID/PAYMENT_FAILED có lý do, reason validation, chặn status bypass, terminal immutability, completedAt, active + terminal list, cancel races, rollback và migration dữ liệu cũ.

Sau khi nhập `origin/main:b87db13` ngày 2026-10-18, lần chạy đầu tìm thấy một fixture `payment-status.postgres.spec.ts` còn gọi `staffTransition(...,'CANCELLED')`; production API từ chối đúng vì thiếu reason. Fixture được đổi sang `staffCancel(...,'Khách yêu cầu hủy')`, không thay logic Payment. Chạy lại trên image mới: Prisma generate, backend build local/Docker, lint và **25 suites/270 tests PASS, 0 skipped**. Script áp đủ 11 migration trên PostgreSQL tạm `brewlite_orders_test_<uuid>` rồi xóa DB thành công. Frontend Webpack production build PASS và unit **14/14 PASS**; unit cần chạy ngoài sandbox trên máy Windows vì `tsx` trong sandbox báo `uv_os_get_passwd ENOMEM`. Đây là bằng chứng tích hợp sau merge; chưa chạy browser E2E ở lượt cập nhật này.
