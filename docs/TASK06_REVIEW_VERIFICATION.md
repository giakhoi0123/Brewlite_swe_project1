# Task 06 — chuẩn bị lại PR và kiểm chứng trên main mới

Ngày 2026-10-17; nhánh `feature/task-06-orders`. PR nghiệm thu: [#16](https://github.com/giakhoi0123/Brewlite_swe_project1/pull/16), đang mở vào main, chưa merge. Không tạo PR trùng hoặc nhánh codex mới vì PR thay thế đã có.

## Đối chiếu Git trước khi thay đổi

- Đã đọc AGENTS/README/PROJECT_CONTEXT/IMPLEMENTATION_PLAN và fetch origin. Working tree chỉ có audit/tmp chưa commit; giữ nguyên, không đưa vào PR.
- `origin/main`: **bacb7a66bef50b222d79ac86fa71fd7063ecda09**, đã nhận PR #18 Payment consistency.
- `origin/feature/task-06-orders`: **03ff19bcaa5853b238a50236b4a4b9c51e808d5c**, trùng head của PR #16 đang mở.
- PR #13: closed, merged=false; nhánh cũ codex/task-06-orders đã bị xóa trên remote, code không mất.
- `git log` xác nhận đủ 5 commit; `git cherry origin/main origin/feature/task-06-orders` đều dấu `+`, không có commit hoặc bản vá tương đương trong main tại lúc audit.

| Commit gốc giữ nguyên | Phần công việc | Có trong main lúc audit |
|---|---|---|
| `1ae95e00e540121e679bcdeaae606c17a89c23c1` | Đồng bộ fixture với PromotionDiscount và Products contract | Chưa |
| `0873e35316c8164c59269878df595d71ccd2f3b5` | Validation đá/đường, chuẩn hóa UUID và regression | Chưa |
| `535660e0d5461235d39cf32c98cadec0f3f4e21b` | PostgreSQL/browser tests, test:postgres và browser channel | Chưa |
| `71665872b31e54f79b05783d802799b7ce2401e9` | Ma trận nghiệm thu/tài liệu/bằng chứng lần đầu | Chưa |
| `03ff19bcaa5853b238a50236b4a4b9c51e808d5c` | Liên kết PR ban đầu và chuẩn hóa log | Chưa |

Merge main mới vào nhánh hiện có, không squash/cherry-pick lại 5 commit. **Code được kiểm chứng: 2c8adc238844f3b6c7a3c3950b41adfaa2511ad9**, commit `merge(orders): refresh Task 06 review with latest main`. Tài liệu/log/ảnh lần chạy lại được commit sau code này; không thay logic đã kiểm chứng.

## Bảo toàn phần của nhóm

Conflict chỉ ở API_CONTRACT, IMPLEMENTATION_PLAN và PROJECT_STATUS; giữ nội dung Task 06 cùng lịch sử Payment mới, gộp bảng endpoint để không có dòng trùng. So diff với main cho AppModule, toàn bộ payments, OrdersService, StaffOrdersController, order-discount và schema: **không có thay đổi**. Không đưa code Staff/Loyalty chưa có trong main vào PR này.

Thay đổi bổ sung duy nhất ở công cụ kiểm chứng: `verify-orders-postgres.cjs` đặt cả ORDERS_TEST_DATABASE_URL và PAYMENTS_TEST_DATABASE_URL trỏ cùng DB UUID vừa tạo, để suite Payment mới từ main không bị skipped. Không reset/migrate DB ứng dụng.

## Kết quả chạy lại

| Kiểm tra | Kết quả |
|---|---|
| Backend `test:postgres`, PostgreSQL 15.18 thật | **24 suites / 247 tests PASS, 0 skipped**, 10 migration |
| Riêng Orders PostgreSQL | 31 ca thuộc 2 suite được chạy trong bộ tổng (23 create + 8 transactions) |
| Backend build/lint | PASS |
| Full backend test typecheck | PASS — 5 lỗi fixture/import baseline đã được giải quyết bởi commit Task 06 gốc |
| Prisma generate | PASS sau retry tuần tự, xem ghi chú Windows bên dưới |
| Frontend unit | **14/14 PASS** |
| Frontend API mode Webpack build | PASS, TypeScript và 13 static pages |
| Browser Orders API, Edge | **4/4 PASS**; 1440/768/390 và 409 giữ giỏ |
| Lint e2e/orders-api.spec.ts và playwright.config.ts | PASS |
| Lint frontend toàn repo | **FAIL** profile/page.tsx:21 — react-hooks/preserve-manual-memoization, có sẵn trong main |
| Docker Compose | Chưa chạy trong lượt này; PostgreSQL thật chạy tạm riêng |
| Build mặc định Turbopack | Chưa chạy lại; dùng --webpack để tránh blocker tiến trình Windows đã ghi ở lượt cũ |

Lần đầu prisma:generate chạy đồng thời suite DB bị EPERM do query_engine-windows.dll.node đang được process test nạp. Sau khi suite DB kết thúc, chạy lại generate thành công. Không đổi dependency/schema hoặc tắt bảo vệ máy để vượt lỗi.

Lint profile thuộc main, diff Task 06 không sửa file đó. Không gọi frontend lint toàn repo PASS và không sửa UI owner khác trong lượt chuẩn bị PR. Đây là lỗi còn mở để nhóm review riêng.

## Browser Task 06 dừng tại PENDING

Auth/Products/Cart/Orders/PostgreSQL đều thật, data mode api, sandbox controls tắt. E2E đặt `page.route('**/api/payments', route => route.abort('blockedbyclient'))` trước luồng checkout; không trả payment giả. Các assert gồm HTTP 201, owner từ JWT, tổng 90.000đ (2 × 45.000), snapshot L+topping, PENDING với một history, giữ kho từ 8 xuống 6, giỏ còn, Payment count=0, reload vẫn PENDING và không tạo thêm Order. Ca stock=0 trả 409, ở lại checkout, giữ giỏ và không tạo Order.

Đây không phải bằng chứng thanh toán Task 08. Backend tổng có chạy test Payment do kế thừa main, nhưng kết quả browser Task 06 chỉ dùng để nghiệm thu tạo đơn PENDING.

Ảnh checkout/PENDING được chụp từ app thật. Đã xem ảnh desktop/tablet/mobile; UUID dài mobile xuống dòng, trạng thái PENDING và giá đọc được. Không sửa giao diện trong lượt này.

## Bằng chứng

- [Backend PostgreSQL log](evidence/task06-review/backend-postgres.txt)
- [Browser log](evidence/task06-review/browser-checkout.txt)
- [Summary theo SHA](evidence/task06-review/summary.json)
- Checkout: [1440](evidence/task06-review/checkout-1440.png), [768](evidence/task06-review/checkout-768.png), [390](evidence/task06-review/checkout-390.png)
- PENDING: [1440](evidence/task06-review/pending-1440.png), [768](evidence/task06-review/pending-768.png), [390](evidence/task06-review/pending-390.png)

Log/ảnh ngày 16 tại evidence/task06 giữ nguyên làm lịch sử, không dùng thay cho kết quả ngày 17.

## Tái lập

Backend cần PostgreSQL test với quyền CREATE DATABASE. Script tự tạo/migrate/xóa đúng DB UUID riêng; URL đầu vào không bị reset.

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@127.0.0.1:5434/postgres?schema=public'
npm.cmd --prefix backend run prisma:generate
npm.cmd --prefix backend run test:postgres
npm.cmd --prefix backend run build
npm.cmd --prefix backend run lint
node backend/node_modules/typescript/bin/tsc --noEmit --incremental false -p backend/tsconfig.test.json
npm.cmd --prefix frontend test
```

Browser: tạo **DB browser riêng**, migrate; backend PORT=33163, FRONTEND_ORIGIN=http://localhost:33162, PAYMENT_DEMO_CONTROLS=false, JWT_SECRET test. Frontend build/start với NEXT_PUBLIC_DATA_MODE=api, NEXT_PUBLIC_API_URL=http://localhost:33163/api, NEXT_PUBLIC_PAYMENT_DEMO_CONTROLS=false trên cổng 33162. Sau đó:

```powershell
$env:ORDERS_TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@127.0.0.1:5434/brewlite_task06_browser_test?schema=public'
$env:BREWLITE_RUN_ORDERS_E2E = '1'
$env:BREWLITE_E2E_BASE_URL = 'http://localhost:33162'
$env:BREWLITE_E2E_API_URL = 'http://localhost:33163/api'
$env:BREWLITE_E2E_BROWSER_CHANNEL = 'msedge'
npm.cmd --prefix frontend run test:e2e -- e2e/orders-api.spec.ts
```

Lượt này dùng PostgreSQL tạm loopback 55440, backend 33163/frontend 33162, DB browser riêng. Fixture UUID được dọn; DB/server tạm được dừng sau kiểm chứng, không dùng DB nhóm. T06 giữ READY_FOR_REVIEW, chưa merge và không nâng T08/09/10 từ kết quả PENDING.
