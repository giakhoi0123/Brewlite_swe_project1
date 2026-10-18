# Nghiệm thu phần Điệp (TV4) theo báo cáo Assignment 1

Đối chiếu ngày 2026-10-18 với `BrewLite_Assignment1_BaoCao_HoanChinh (2).docx`, đặc biệt mục 12.1 (phân công), các US05/US10/US13–US16, UC14–UC17/UC28–UC32 và kịch bản Barista B01–B05. Báo cáo là yêu cầu nghiệm thu; các dấu hoàn thành trong tài liệu không thay thế kết quả chạy code.

Theo mục 12.1, **Điệp phụ trách T06, T10A, T10C và backend Barista**: Orders API, state machine, transaction/inventory/concurrency và cập nhật trạng thái. Frontend thuộc TV1; Payment thuộc TV5; history khách/Promotion/Loyalty thuộc TV6, phối hợp trạng thái với TV4.

## Đối chiếu yêu cầu và bằng chứng

| Yêu cầu báo cáo | Mã triển khai | Bằng chứng kiểm thử | Đánh giá |
|---|---|---|---|
| US05, T06, UC14–17: tạo đơn PENDING, giá server, validate cấu hình, snapshot, rollback | `backend/src/orders/orders.service.ts`, `dto/create-order.dto.ts`, `order-response.ts` | `orders-create.postgres.spec.ts`, `orders.http.spec.ts`, browser checkout | Backend đã có; kiểm chứng lại trong lượt này |
| US10, T10C, UC16: hai khách tranh món cuối, không âm kho | `backend/src/inventory/inventory.service.ts`, transaction tạo đơn | Bài mới `UC16: two customers compete for the last unit through HTTP` trong `staff-orders.postgres.spec.ts`: 201/409, một đơn/items/history, stock=0 | PASS trên PostgreSQL thật |
| US13, T10A: state machine dùng chung, không đổi terminal state | `order-state-machine.ts`, `OrdersService.transitionInTransaction` | `order-state-machine.spec.ts`: toàn bộ 49 cặp; HTTP và PostgreSQL thử sai bước/retry/rollback | PASS |
| US14, UC28–29, B01–B02: BARISTA mới vào queue, chỉ PAID chờ pha, đủ cấu hình | `staff-orders.controller.ts`, `staffList`, `staffGet`, JWT/Roles guards | HTTP 401/403, detail/privacy; browser đăng nhập riêng hai vai trò, kiểm tra PAID và loại PENDING khỏi queue | Backend có đủ endpoint |
| US15, UC30–31, B03–B04: PREPARING→READY→COMPLETED, khách thấy cùng dữ liệu | `staffTransition`, CAS trạng thái/version, `completedAt` | Bài mới `UC31: simultaneous handover...`: 200/409, một timestamp/history; browser hai phiên refresh từng bước | Backend concurrency PASS |
| US16, UC32, B05: lý do hủy bắt buộc, đúng state, lưu lý do, không tự tuyên bố hoàn tiền | `CancelOrderDto`, `staffCancel`, transaction hoàn kho/history | PostgreSQL reason rỗng/quá dài, mọi state cho phép/cấm, hủy lặp/race/rollback; browser-context request gọi API thật | Backend PASS; nút hủy UI API mode còn cần TV1 bật |
| Chi tiết và lịch sử đơn hoàn tất/hủy | GET `/staff/orders/:id`, GET `/staff/orders`, response `cancelReason?`, `completedAt?` | Staff PostgreSQL: list ổn định, lọc unpaid, terminal fields; API khách trả cùng trạng thái | Backend PASS; màn lịch sử/KPI API mode còn cần TV1 bật |
| Bằng chứng và bàn giao, mục 13 | Script tự tạo DB riêng, ma trận này, ảnh và log | Xem thư mục `docs/evidence/tv4-acceptance/` | Không dùng UI mock để kết luận API hoàn thành |

## Kết quả lượt kiểm chứng

- Nền `6851515` trên nhánh `feature/orders-and-inventory`, cộng các thay đổi chưa commit của lượt này. Nhánh không đổi.
- **25 suites / 272 tests PASS, 0 skipped**, bật cả ORDERS_TEST_DATABASE_URL và PAYMENTS_TEST_DATABASE_URL trên PostgreSQL 15 trong Docker. Gồm unit/HTTP và các suite PostgreSQL; không có nghĩa cả 272 bài đều truy cập DB. Đủ **11 migrations**, database UUID tạm tự dọn. [Log backend](evidence/tv4-acceptance/backend-tests.txt).
- Backend Docker build, local Nest build, lint và `tsc --noEmit --incremental false -p tsconfig.json` PASS. Không còn lỗi typecheck fixture Products từng ghi ở các mốc cũ.
- **Browser PASS ở 1440/768/390** trên Microsoft Edge 155, frontend production build Webpack/API mode và hai phiên đăng nhập thật. [result.json](evidence/tv4-acceptance/result.json) ghi `passed: true`, đủ ba viewport và `isolatedDatabaseRemoved: true`.
- Kiểm tra lại trước commit/push theo yêu cầu: Docker build + 272 backend tests, backend lint/full typecheck, **14/14 frontend service tests**, browser ba viewport và frontend build cấu hình local đều PASS. Runner đã chỉnh hai luồng stdout/stderr cùng ghi log để chỉ đóng file sau khi process kết thúc; đối chiếu history theo version để không phụ thuộc timestamp trùng nhau.
- **Lint toàn frontend FAIL: 1 lỗi có sẵn** `react-hooks/preserve-manual-memoization` tại `frontend/src/app/profile/page.tsx:21`. File này không thay đổi so với `origin/main`; không sửa UI thuộc TV1 trong commit nghiệm thu TV4. Không tuyên bố lint toàn repo PASS.

| Viewport | Queue PAID của Barista | Khách thấy COMPLETED |
|---|---|---|
| 1440 | [Ảnh](evidence/tv4-acceptance/staff-paid-1440.png) | [Ảnh](evidence/tv4-acceptance/customer-completed-1440.png) |
| 768 | [Ảnh](evidence/tv4-acceptance/staff-paid-768.png) | [Ảnh](evidence/tv4-acceptance/customer-completed-768.png) |
| 390 | [Ảnh](evidence/tv4-acceptance/staff-paid-390.png) | [Ảnh](evidence/tv4-acceptance/customer-completed-390.png) |

Script browser dùng hai BrowserContext độc lập, login UI thật, cookie HttpOnly khác nhau; không chặn hay trả response giả cho API. Checkout gọi Orders/Payments thật trên PostgreSQL riêng; **gateway Payment vẫn là MockPaymentGateway** theo bài tập, không chứng minh giao dịch tiền thật. Kiểm tra UI queue và ba lần chuyển trạng thái có modal xác nhận, khách refresh thấy từng trạng thái; đối chiếu DB/history/completedAt. Hủy/lịch sử kiểm qua API thật bằng cookie hai phiên, không đánh dấu luồng UI hủy/lịch sử đã qua.

## Chạy lại

Từ thư mục gốc repo, đã cài dependencies backend/frontend, Node.js và Docker Desktop. PostgreSQL local phải chạy; `.env` chứa DATABASE_URL đúng cổng host (mặc định 5434), tài khoản có quyền tạo database thử nghiệm. Các lệnh này không reset database ứng dụng.

```powershell
docker compose up -d postgres
docker compose build backend
docker compose run --rm --no-deps backend npm run test:postgres

npm.cmd --prefix backend run lint
Push-Location backend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json
Pop-Location

node backend/scripts/verify-tv4-browser.cjs
```

Runner browser mặc định dùng Edge (`msedge`); có thể đặt `$env:PLAYWRIGHT_CHANNEL = "chrome"` nếu máy có Chrome. Cần để trống cổng 33220/33221. Runner tự migrate **database mới có UUID**, build backend và frontend Webpack ở API mode, khởi động hai server, chạy 1440/768/390, ghi ảnh/JSON/log, dừng server và xóa đúng database nó tạo. Lỗi trả exit code khác 0. Lần chạy thành công không xóa bằng chứng lỗi của lượt trước; xem `result.json` và thời gian file khi đọc ảnh.

Lệnh build ghi lại `frontend/.next` cho API thử nghiệm ở cổng 33221. Sau nghiệm thu, muốn chạy frontend local cho ứng dụng thường cần chạy dev với biến API của mình hoặc build lại với cấu hình ứng dụng. Trong lượt 2026-10-18 này đã chạy lại `npm.cmd --prefix frontend run build -- --webpack` không đặt biến test, PASS, để trả build về cấu hình local. Runner không cập nhật container frontend hay DB ứng dụng.

## Phần còn phối hợp, không phải thiếu backend TV4

1. **TV1:** `frontend/src/components/barista-board.tsx` vẫn kiểm tra `dataMode !== "api"` để ẩn nút hủy; view history ở API mode hiển thị placeholder “đang chờ API Staff Orders”; KPI hoàn tất hiện dấu gạch. Backend cần dùng đã có và đã test. Bật adapter hiện có, hiển thị `cancelReason`/`completedAt`, tải detail mới nhất và kiểm thử UI hủy/lịch sử. Bỏ thông báo cũ cuối màn KDS “còn chờ TV4” sau khi nối UI. Không thay UI thuộc owner khác trong lượt này.
2. **TV5:** hủy đơn PAID chưa phải hoàn tiền. Không tự thêm refund hoặc cho hủy PREPARING; báo cáo coi ngoại lệ này là đề xuất cần nhóm chốt. Gateway demo không phải provider thật.
3. **Nhóm trưởng/TV6:** review thay đổi, tích hợp UI/history, chạy nghiệm thu toàn hệ thống và áp dụng migration lên môi trường nhóm theo quy trình. Các test ở đây dùng DB riêng, không có nghĩa DB nhóm đã migrate hoặc code đã push/merge.

Phần backend TV4 sẵn sàng review theo phạm vi trên; không gắn VERIFIED_COMPLETE cho toàn bộ Barista vì B05 trên UI thật và màn lịch sử/KPI vẫn phụ thuộc TV1.
