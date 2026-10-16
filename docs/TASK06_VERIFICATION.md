# Task 06 — API tạo đơn: triển khai và kiểm chứng

Ngày: 2026-10-16. Nhánh: `codex/task-06-orders`.

PR nghiệm thu: [#13 — Task 06](https://github.com/giakhoi0123/Brewlite_swe_project1/pull/13), mở vào `main`, chờ review nhóm.

## Phạm vi và trạng thái

Task 06 yêu cầu NestJS `POST /orders` nhận giỏ hợp lệ, validate bằng class-validator, lưu Order/OrderItems ở trạng thái **PENDING** và trả mã đơn. Guard phải lấy chủ đơn từ phiên xác thực; giá phải được tính lại từ catalog server. Task 06 kết thúc tại PENDING, chưa xác nhận thanh toán.

**READY_FOR_REVIEW**: triển khai và kiểm chứng kỹ thuật đã hoàn thành; còn review PR của nhóm theo Definition of Done. Không đánh dấu Task 08, Task 09 hay toàn bộ Task 10 hoàn thành từ các kết quả này.

Đã fetch/pull trước khi làm: local ban đầu `a80e712` chậm 2 commit; cập nhật fast-forward tới `origin/main` **c2d6922** (PR #12, có thay đổi Payment/Promotion/Loyalty), rồi mới tạo nhánh. Các tài liệu audit chưa commit của lượt trước được giữ riêng ở stash `pre-task06: preserve local requirements audit`, không đưa vào PR Task 06.

## Thay đổi theo từng phần

| Commit | Nội dung |
|---|---|
| `1ae95e0` | Đồng bộ test Orders với PromotionDiscount của main mới; sửa fixture Products theo contract stock/description thực tế. Không đổi nghiệp vụ Product/Promotion |
| `0873e35` | Chuẩn hóa UUID sản phẩm/topping về chữ thường; chặn topping trùng khác hoa/thường; kiểm tra đá/đường theo danh sách Cart hiện có; bổ sung HTTP regression |
| `535660e` | Thêm 23 ca PostgreSQL cho tạo đơn, 4 browser E2E API, script `test:postgres` và tùy chọn browser channel |
| `7166587` | Cập nhật contract/trạng thái/kế hoạch và lưu bằng chứng test, ảnh ứng dụng thật |
| Commit bàn giao PR | Ghi liên kết PR #13 và chuẩn hóa khoảng trắng log kiểm chứng |

Orders/Inventory core có sẵn của TV4 được tái sử dụng. Không thay luồng state machine, stock transaction, Payment port hoặc chính sách ưu đãi của thành viên khác; không thêm migration nghiệp vụ mới.

## Ma trận nghiệm thu Task 06

| Tiêu chí | Kiểm chứng | Kết quả |
|---|---|---|
| JWT thật, CUSTOMER từ DB | Đăng ký qua Auth thật, cookie JWT, chặn thiếu phiên/BARISTA/Origin lạ | PASS |
| Validate giỏ | Rỗng, số lượng 0/âm/lẻ/chuỗi, UUID/size/topping sai, tùy chọn tạm ngừng, đá/đường sai, topping trùng khác hoa/thường | PASS |
| Không tin dữ liệu client | Từ chối userId/total/discount/status và đơn giá/thành tiền do client tự gửi | PASS |
| Giá server | 30.000 + size L 9.000 + topping 6.000 = 45.000/ly; 2 ly = **90.000đ** | PASS |
| Mã đơn và PENDING | HTTP 201, UUID đơn, userId từ cookie, Order/OrderItems/topping snapshot và một history PENDING trong PostgreSQL | PASS |
| Tính nguyên tử và tồn kho | Thiếu hàng trả 409; món sau hết hàng rollback khoản giữ món trước; tổng nhiều cấu hình cùng Product không vượt kho; bộ race/rollback cũ cũng chạy thật | PASS |
| Giữ giỏ trước thanh toán | Cart vẫn còn sau tạo PENDING và sau lỗi; không tạo Payment, không tăng điểm | PASS |
| Browser API thật | Chọn size/topping → giỏ → đăng ký → merge giỏ → checkout → POST 201 → mở lại chi tiết vẫn PENDING | PASS 1440/768/390 |
| Lỗi tạo đơn trong browser | Đổi stock fixture thành 0 trước checkout: 409, giữ trang checkout/giỏ 2 món, không lưu đơn | PASS |
| Build, lint, kiểu dữ liệu | Backend build/lint/typecheck đầy đủ; lint các file frontend thay đổi; frontend API build Webpack | PASS |
| Commit/review | Chia commit theo phần, tạo PR để nhóm review | Chờ review nhóm |

Browser E2E **chặn request `/payments` sau khi tạo đơn bằng `route.abort()`**, không trả payment giả và không thay Auth/Cart/Products/Orders bằng mock. Cách cô lập này giữ nguyên ranh giới Task 06: chứng minh dữ liệu PENDING được lưu thật, không coi kết quả là kiểm chứng thanh toán Task 08.

## Kết quả chạy thực tế

Môi trường: Windows, Node 24.11.0, PostgreSQL **15.18** chạy tạm trong repo ở loopback 55436; không cài dịch vụ Windows và không sử dụng DB chung. `test:postgres` tạo thêm DB `brewlite_orders_test_<uuid>`, áp đủ **8 migration**, chạy tất cả test rồi xóa đúng DB tạm. DB browser riêng là `brewlite_task06_test`; fixture được xóa theo UUID của lượt test.

| Kiểm tra | Kết quả |
|---|---|
| Backend `test:postgres` | **19 suites, 201/201 tests PASS; 0 skipped** |
| Riêng 2 suite Orders PostgreSQL | **31/31 PASS** (23 mới + 8 có sẵn) |
| Backend build/lint | PASS |
| Backend test typecheck `tsc --noEmit -p tsconfig.test.json` | PASS |
| Frontend unit | **13/13 PASS** |
| Browser Edge, API mode | **4/4 PASS**, 3 viewport và 1 ca thiếu hàng |
| Lint file frontend thay đổi | PASS `e2e/orders-api.spec.ts`, `playwright.config.ts` |
| Frontend build API mode | PASS `next build --webpack`, gồm TypeScript và 13 static pages |
| Frontend lint toàn repo | FAIL có sẵn trong `origin/main:c2d6922`, `src/app/profile/page.tsx:21` — `react-hooks/preserve-manual-memoization`; không nằm trong thay đổi Task 06 |
| Frontend build mặc định/Turbopack | Lỗi tạo/kết nối tiến trình CSS đã gặp ở mốc audit trước; dùng Webpack để kiểm chứng, không đổi script build mặc định |
| Docker Compose | Chưa chạy trên máy này vì không có Docker CLI; không dùng kết quả Task 06 để chốt Task 01/09 triển khai |

Log và ảnh thật: [evidence/task06](evidence/task06/).

- [Backend PostgreSQL output](evidence/task06/backend-postgres.txt)
- [Browser output](evidence/task06/browser-checkout.txt)
- Checkout: [1440](evidence/task06/checkout-1440.png), [768](evidence/task06/checkout-768.png), [390](evidence/task06/checkout-390.png)
- Đơn PENDING: [1440](evidence/task06/pending-1440.png), [768](evidence/task06/pending-768.png), [390](evidence/task06/pending-390.png)

Ảnh chứng minh ứng dụng ở API mode, không phải ảnh thiết kế Stitch. Kiểm tra ảnh thấy nội dung đọc được và không bị cắt; UUID dài trên mobile xuống dòng. Không sửa UI trong PR này.

## Chạy lại backend PostgreSQL tests

Cài dependencies ở cả frontend/backend và tạo Prisma Client như README. Cần một PostgreSQL 15 local có tài khoản được phép CREATE DATABASE. Không dùng dữ liệu sản xuất. Ví dụ PowerShell từ repo, thay thông tin kết nối mẫu:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5434/postgres?schema=public'
npm.cmd --prefix backend run prisma:generate
npm.cmd --prefix backend run test:postgres
```

Script chỉ tạo/migrate/xóa database riêng mang tên UUID; không truncate/reset/seed DB ở URL đầu vào. Nếu không đặt `ORDERS_TEST_DATABASE_URL`, lệnh Jest thông thường sẽ bỏ qua hai suite PostgreSQL; kết quả đó không thay thế `test:postgres`.

## Chạy lại browser Task 06

Chuẩn bị **database test riêng đã tạo**, ví dụ `brewlite_task06_test`. Không dùng DB demo/chung cho bộ E2E. Không cần seed catalog: suite tự tạo/xóa sản phẩm, topping và tài khoản của mình.

Terminal 1 — backend (PowerShell từ repo):

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5434/brewlite_task06_test?schema=public'
$env:JWT_SECRET = 'task06-local-test-secret-never-production'
$env:FRONTEND_ORIGIN = 'http://localhost:33160'
$env:PORT = '33161'
$env:NODE_ENV = 'test'
npm.cmd --prefix backend run prisma:migrate
npm.cmd --prefix backend run build
npm.cmd --prefix backend run start:prod
```

Terminal 2 — frontend API mode:

```powershell
$env:NEXT_PUBLIC_DATA_MODE = 'api'
$env:NEXT_PUBLIC_API_URL = 'http://localhost:33161/api'
npm.cmd --prefix frontend run build -- --webpack
npm.cmd --prefix frontend run start -- --port 33160
```

Terminal 3 — browser test, cùng database test với backend:

```powershell
$env:ORDERS_TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5434/brewlite_task06_test?schema=public'
$env:BREWLITE_RUN_ORDERS_E2E = '1'
$env:BREWLITE_E2E_BASE_URL = 'http://localhost:33160'
$env:BREWLITE_E2E_API_URL = 'http://localhost:33161/api'
$env:BREWLITE_E2E_BROWSER_CHANNEL = 'msedge'
npm.cmd --prefix frontend run test:e2e -- e2e/orders-api.spec.ts
```

Có thể bỏ biến channel nếu đã cài Chromium của Playwright. Dừng hai server test sau khi chạy; chạy lại frontend bằng cấu hình nhóm khi trở về demo. Không commit `.env` hoặc thông tin kết nối DB thật.

## Handoff ngoài phạm vi Task 06

Main mới đã đăng ký PaymentsModule và thay provider PromotionDiscount, nên các ghi chú cũ “chưa đăng ký Payment/chưa có provider ưu đãi” không còn mô tả đúng mã nguồn. Tuy nhiên Task 08 vẫn cần kiểm chứng riêng: adapter trong AppModule dùng tên SUCCESS/FAILED trong khi Payment core trả PAID/PAYMENT_FAILED, replay/retry và tính nguyên tử cần owner TV5/TV6 xử lý. Không sửa những phần này để lấy kết quả PASS của Task 06.

Task 06 không đòi phải thanh toán PAID, hoàn tất Staff API hay có TTL hủy PENDING. Những phần đó được theo dõi riêng; tạo đơn thành công không tự xóa giỏ hay cấp điểm.
