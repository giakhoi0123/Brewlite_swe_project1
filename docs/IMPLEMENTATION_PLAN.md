# Kế hoạch triển khai BrewLite 1.0

## Kết quả Task 06 — 2026-10-16

Nhánh `codex/task-06-orders` tạo sau khi cập nhật `origin/main:c2d6922`. Phần triển khai và kiểm chứng kỹ thuật Task 06 đã xong, **READY_FOR_REVIEW** để nhóm review PR theo DoD. Backend 201/201 trên PostgreSQL thật, 0 skipped; browser API 4/4 ở 1440/768/390; build/lint/typecheck liên quan PASS. Chi tiết/commit/bằng chứng tại [TASK06_VERIFICATION.md](TASK06_VERIFICATION.md). Không nâng Task 08/09/10 từ kết quả tạo PENDING. Các bảng workstream cũ bên dưới là lịch sử.

## Payment consistency — 2026-10-17, mới nhất

Trên nhánh hiện có `feature/fix-payment-status`, đã xác minh bản sửa trạng thái `b6ca9ac` là ancestor. Claim/settle dùng khóa Order; partial unique live-attempt index, retry reserve trước gateway, journal và atomic Payment/Order/points đã triển khai. **9 suites/111 tests PASS (40 PostgreSQL), build/lint/Payment typecheck PASS**; có script tái lập `test:payments:postgres` tạo/xóa DB riêng. Phạm vi consistency READY_FOR_REVIEW trong PR #18; T08/10B toàn bộ vẫn IN_PROGRESS vì browser/triển khai/đối soát provider còn thiếu. Xem [PAYMENT_CONSISTENCY_VERIFICATION.md](PAYMENT_CONSISTENCY_VERIFICATION.md). Các ghi chú retry/replay chưa làm ở mốc dưới đã được thay thế bằng kết quả này.

## Payment status — 2026-10-17

Nhánh `feature/fix-payment-status` từ main `c2d6922`: đã sửa hợp đồng trạng thái adapter AppModule theo PAID/PAYMENT_FAILED/UNKNOWN và kiểm tra ownership; 80/80 tests liên quan PASS, gồm 15 ca PostgreSQL qua AppModule thật, build/lint PASS. Xem [PAYMENT_STATUS_VERIFICATION.md](PAYMENT_STATUS_VERIFICATION.md). **T08/10B tiếp tục IN_PROGRESS** vì retry/replay/atomicity và E2E toàn luồng chưa hoàn tất. Không dùng bản sửa này để chốt toàn bộ Payment, Loyalty hoặc Task 06.

## Kiểm kê workstream TV1 ngày 2026-10-16

Đã đối chiếu mã nguồn với cả 9 `stitch/*/code.html`, 9 `screen.webp` và `DESIGN.md`. Nhánh hiện tại là `feature/auth-and-base`, cây làm việc sạch trước lượt sửa.

| ID | Hạng mục | Owner | Trạng thái ban đầu | Tệp | Tiêu chí nghiệm thu | Kiểm chứng hiện có | Việc còn lại |
|---|---|---|---|---|---|---|---|
| A | Audit repo và Stitch | TV1 | IN_PROGRESS | `stitch/`, `frontend/`, `backend/src/auth/`, `docs/` | Xác định đúng mã và khác biệt thiết kế | 9 export, screenshot và auth/Barista đã kiểm kê | Ghi kết quả QA thực tế |
| B | Design system | TV1 | IN_PROGRESS | `stitch/**/DESIGN.md`, `frontend/src/app/globals.css` | Token, typography, layout bám Stitch | Có palette espresso/cream và serif/body; Barista chưa bám bố cục KDS | So sánh render thực tế |
| C | Thành phần dùng chung | TV1 | IN_PROGRESS | `frontend/src/components/` | Điều hướng, trạng thái, modal dùng nhất quán | Shell, badge, loading/error có | Chuẩn hóa Barista shell và xác nhận hành động |
| D | UI khách hàng | TV1 | UI_COMPLETED | `frontend/src/app/` | Menu → thanh toán → đơn hàng, responsive, trạng thái lỗi | Các route đã có; Cart/Payment vừa tích hợp từ nhóm | Kiểm tra lại sau merge, so sánh từng màn Stitch |
| E | Auth đầy đủ | TV1 | IN_PROGRESS | `backend/src/auth/`, `frontend/src/app/login`, `register` | Cookie/JWT, role, logout vô hiệu hóa phiên cũ | Register/login/me, guard và bcrypt có; logout chỉ xóa cookie | Bổ sung invalidation phiên và frontend guard |
| F | Test bảo mật Auth | TV1 | IN_PROGRESS | `backend/src/auth/*.spec.ts`, `frontend/e2e/` | Negative/expiry/role/CSRF/logout | Có RBAC và CORS tests; thiếu chứng minh token cũ hết hiệu lực sau logout | Bổ sung test tự động và DB E2E khi có môi trường |
| G | Barista frontend | TV1 | IN_PROGRESS | `frontend/src/app/barista/`, `frontend/src/services/` | 5 view, hàng đợi, lịch sử, chi tiết, xác nhận/hủy | Chỉ một dashboard 3 cột; hủy không hỏi lý do; chưa có history | Dựng theo Stitch KDS, dùng adapter hiện có |
| H | Test Barista | TV1 | NOT_STARTED | `frontend/src/services/*.test.ts`, `frontend/e2e/` | Chuyển trạng thái, reason, role, trạng thái lỗi | Có một luồng happy path trong E2E cũ | Bổ sung unit/E2E thực tế |
| I | QA responsive/visual | TV1 | IN_PROGRESS | `frontend/e2e/`, `stitch/` | 1440/768/390, đối chiếu ảnh | Trước đây đã smoke vài màn; chưa kiểm tra Barista mới | Chụp/so sánh nếu browser chạy được |
| J | Tích hợp API | TV1+TV4–TV6 | BACKEND_PENDING | `frontend/src/services/api.ts`, `docs/API_CONTRACT.md` | API mode không fallback mock | Products/Cart thật, auth thật; Orders/Staff/Promotions/Loyalty thiếu server | Bàn giao contract theo owner |
| K | Tài liệu và bàn giao | TV1 | IN_PROGRESS | `README.md`, `docs/*`, `AGENTS.md` | Trạng thái đúng bằng chứng | Có tài liệu nhưng số test/chế độ hybrid không đồng bộ ở vài chỗ | Đồng bộ sau kiểm thử |

Khác biệt lớn nhất với Stitch là Barista: export có header KDS, sidebar, KPI, Kanban ticket, ghi chú và modal sự cố; React hiện chỉ có ba cột thẻ đơn. Auth có lỗ hổng phiên stateless sau logout: JWT cũ vẫn xác thực được nếu còn bản sao. Backend Staff Orders chưa có nên frontend Barista chỉ có thể kiểm chứng mock; không gọi mock ngầm khi API mode lỗi. Các màn khách hàng đã dùng ảnh và palette từ Stitch nhưng vẫn cần QA trực quan 1440/768/390 sau lượt tích hợp Cart/Payment.

### Kết quả triển khai TV1 ngày 2026-10-16

Bảng kiểm kê trên là trạng thái **trước khi sửa**. Kết quả hiện tại dưới đây là nguồn trạng thái cho lượt này; các mốc cũ phía dưới là lịch sử dự án.

| ID | Hạng mục | Owner | Trạng thái hiện tại | File chính | Tiêu chí nghiệm thu | Bằng chứng đã chạy | Còn lại |
|---|---|---|---|---|---|---|---|
| A | Kiểm kê repo, 9 màn Stitch, tài liệu và test | TV1 | VERIFIED_COMPLETE | `stitch/`, `docs/`, `frontend/`, `backend/src/auth/` | Đúng module, owner, khoảng trống | Đọc HTML/ảnh của 9 màn và DESIGN.md; bảng baseline ở trên | Không |
| B | Design system và so sánh Stitch | TV1 | UI_COMPLETED | `frontend/src/app/globals.css`, `profile/profile.css`, `barista-board.css` | Espresso/cream, serif, bố cục KDS và hồ sơ | Chụp Barista và hồ sơ 1440/768/390; đối chiếu ảnh Stitch | Sai khác có chủ ý: không hiển thị số liệu/voucher giả |
| C | Shell và trạng thái dùng chung | TV1 | VERIFIED_COMPLETE | `components/shell.tsx`, `components/ui.tsx` | Staff shell riêng, điều hướng và loading/error | Build, E2E 4/4; tablet không tràn header | Không |
| D | Customer UI | TV1 | UI_COMPLETED | `app/`, `profile/` | Luồng menu→đơn, hồ sơ, trạng thái và mobile | E2E demo 4/4; browser QA 1440/768/390; Orders REST adapter có 5 tests | Payment/Loyalty API thật thuộc TV5–TV6; Orders browser API E2E còn chờ |
| E | Auth frontend và backend | TV1 | VERIFIED_COMPLETE | `backend/src/auth/`, `frontend/src/components/auth-provider.tsx` | JWT HttpOnly, role từ DB, logout vô hiệu phiên | 59/59 backend tests, PostgreSQL HTTP smoke, E2E role/refresh/logout | Cần triển khai migration trên DB chung khi tích hợp |
| F | Auth bảo mật | TV1 | VERIFIED_COMPLETE | `auth.rbac.spec.ts`, `csrf.middleware.spec.ts`, `smoke_http.py` | Validate, 401/403, tamper/expiry, CSRF, no-store | Jest 59/59; smoke trên DB QA và cookie cũ 401 sau logout | Rate limit là phần cứng hóa thêm, chưa làm |
| G | Barista UI + adapter | TV1 | UI_COMPLETED | `barista-board.tsx`, `services/{api,mock,contracts}.ts` | 5 route, KPI, queue, confirm, cancel, history | E2E mock PAID→COMPLETED/hủy; QA 3 viewport | TV4 đã có list/transition; detail/hủy lý do/history API còn chờ |
| H | Barista frontend tests | TV1 | VERIFIED_COMPLETE (mock) | `mock.test.ts`, `flow.spec.ts` | Lọc unpaid, transition, reason, role, sync | Frontend unit 13/13 và E2E demo 4/4 trước merge | Browser Staff API E2E còn chờ |
| I | Responsive và visual QA | TV1 | UI_COMPLETED | `stitch/`, ảnh QA tại `/tmp/brewlite-*.png` | 1440/768/390, không tràn, so sánh các màn | Browser QA các route chính; sửa lỗi header 768; Barista 5 view x 3 viewport | QA thêm dữ liệu rất dài và API mode sau TV4 |
| J | Integration API | TV1+TV4–TV6 | IN_PROGRESS | `services/api.ts`, `docs/API_CONTRACT.md` | API mode không fallback, ownership server | Adapter typed; Products/Cart/Auth/Orders backend; merged backend PostgreSQL 168/168 | Browser Orders/Staff E2E; TV4 Staff phần còn thiếu, TV5 Payment, TV6 Promotions/Loyalty |
| K | Tài liệu, cấu trúc và bàn giao | TV1 | VERIFIED_COMPLETE | `README.md`, `docs/*`, `AGENTS.md` | Tình trạng, test và việc còn lại rõ ràng | Tài liệu cập nhật theo mã/test lượt này | TV4–TV6 cập nhật tiếp khi API có thật |

Quyết định bảo mật: cột `users.session_version` được thêm bằng migration chỉ cộng cột, mặc định 0; JWT mới mang version, `/auth/logout` tăng version trong DB. Token bị sao chép trước logout sẽ nhận 401. Đổi lại, logout trên một thiết bị làm hết hiệu lực mọi phiên của tài khoản. Cookie vẫn HttpOnly/SameSite=Lax, Secure khi production và Origin guard bảo vệ lệnh ghi.

Quyết định Barista: PAID→PREPARING→READY→COMPLETED; chỉ PENDING/PAID/PAYMENT_FAILED được hủy với lý do. PREPARING không được hủy ở UI/mock cho đến khi TV4 thống nhất state machine. `completedAt` trong mock ghi lúc bàn giao để KPI “đã giao hôm nay” có dữ liệu thật; TV4 cần trả trường này trong API.

## 1. Tổng quan
BrewLite là ứng dụng đặt cà phê và thanh toán không tiền mặt cho bài tập Công nghệ phần mềm. Luồng khách hàng: xem menu → tùy chỉnh món → giỏ → đăng nhập → đặt đơn PENDING → thanh toán → theo dõi. Luồng Barista tùy chọn: PAID → PREPARING → READY → COMPLETED. Stack: Next.js App Router, React, TypeScript, Tailwind, Zustand; NestJS, PostgreSQL, Prisma, class-validator, bcrypt, JWT; Docker Compose.

## 2. Lộ trình
| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Kiểm kê 9 màn Stitch, DESIGN.md, trạng thái repo | VERIFIED_COMPLETE |
| 1 | Kế hoạch và tài liệu ban đầu | VERIFIED_COMPLETE |
| 2 | Monorepo, cấu hình, môi trường | VERIFIED_COMPLETE |
| 3 | Thành phần UI dùng chung | VERIFIED_COMPLETE |
| 4 | Menu và sản phẩm | VERIFIED_COMPLETE |
| 5 | Tùy chỉnh và giỏ | VERIFIED_COMPLETE |
| 6 | Auth full stack | VERIFIED_COMPLETE |
| 7 | Checkout và đơn hàng | UI_COMPLETED |
| 8 | Kết quả thanh toán | UI_COMPLETED |
| 9 | Lịch sử, theo dõi, ưu đãi, điểm | UI_COMPLETED |
| 10 | Barista | UI_COMPLETED |
| 11 | Adapter và hợp đồng API | UI_COMPLETED |
| 12 | Kiểm thử, Docker, bàn giao | VERIFIED_COMPLETE (phần TV1); BACKEND_PENDING (API TV4–TV6) |

## 3. Theo dõi Task chính thức
Chỉ đổi thành `VERIFIED_COMPLETE` khi toàn bộ tiêu chí của Task đã chạy kiểm thử thành công. `UI_COMPLETED` chỉ phản ánh frontend; `BACKEND_PENDING` phản ánh backend chưa tích hợp.

| ID | Mô tả | Chủ sở hữu | Trạng thái | Phụ thuộc | Tệp liên quan | Tiêu chí nghiệm thu | Bằng chứng kiểm thử | Việc còn lại |
|---|---|---|---|---|---|---|---|---|
| T01 | Khởi tạo dự án | TV1 | VERIFIED_COMPLETE | Không | README, frontend, backend, compose | Chạy được 3 thành phần | Compose 3 container chạy; frontend/backend HTTP 200; Git và README có | Không |
| T02 | Products API | TV2 | VERIFIED_COMPLETE | DB | backend/src/products | GET /products trả JSON | PostgreSQL seed 10 món; GET list/detail HTTP 200; backend tests qua | Không |
| T03 | Menu | TV1+TV2 | VERIFIED_COMPLETE | T02 | frontend/src/app/page.tsx | API, loading, empty | Playwright API mode: 10 món, loading/empty/error/retry; DB thật | Không |
| T04 | Tùy chỉnh | TV1+TV3 | VERIFIED_COMPLETE | T02 | frontend/src/app/products | Size, topping, giá | Playwright API mode: S/M/L, topping, giá động, thêm giỏ | Chính sách giá lâu dài cần TV3 xác nhận |
| T05 | Giỏ | TV1+TV3 | VERIFIED_COMPLETE | T04 | frontend/src/stores, frontend/src/components/cart-sync.tsx, backend/src/cart | Thêm/sửa/xóa/tổng/badge; giỏ lưu theo tài khoản | Playwright: cấu hình riêng, tăng/giảm/xóa/clear, tổng, badge, refresh; 11 backend cart tests; HTTP PostgreSQL 12/12; luồng API mode khách→đăng ký→gộp→sửa→reload→đăng xuất/nhập 8/8 | TV4 nối `POST /orders` với `cart-pricing.ts` và xóa giỏ server khi đơn PAID |
| T06 | Orders API | TV4 | READY_FOR_REVIEW (kỹ thuật đã kiểm chứng) | Auth, products | backend/src/orders, backend/src/inventory, frontend/e2e/orders-api.spec.ts | POST /orders validate, giá server, lưu PENDING và trả mã đơn | PostgreSQL 15: 19 suites/201 tests, 0 skipped; browser API 4/4 tại 1440/768/390; build/lint/typecheck liên quan PASS | Review PR nhóm; Task 08/09/10 theo dõi riêng |
| T07 | Auth | TV1 | VERIFIED_COMPLETE (module Auth TV1) | DB | backend/src/auth, frontend/src/app/login, frontend/src/app/register | Đăng ký/nhập/JWT/guard/logout | Sau merge: 168/168 backend tests; HTTP QA cookie cũ 401 sau logout; Playwright role/redirect trước merge qua | Áp migration Auth trên DB nhóm |
| T08 | Payment | TV1+TV5 | IN_PROGRESS | T06 | frontend/src/services, frontend/src/app/payment, backend/src/payments, backend/prisma | Wallet/Card, PAID/FAILED/UNKNOWN, idempotency | Orders port/module/FK đã nối; PostgreSQL Payment 2 suite/18 test; browser API FAILED→quay lại checkout→retry PAID cùng order qua; Order trả phương thức PAID và màn success vẫn hiện đúng sau reload; checkout retry QA 1440/768/390 qua | Gateway production và browser E2E mở rộng UNKNOWN/Wallet |
| T09 | Xác nhận/lịch sử/Docker | TV1+TV6 | BACKEND_PENDING | T06,T08 | frontend/src/app/orders, compose | GET /orders/me, demo E2E | Playwright history/timeline + Compose 3 dịch vụ qua | Orders history backend thật |
| T10 | Logic nâng cao | TV4+TV5+TV6 | IN_PROGRESS | T06,T08 | backend/src/orders, backend/src/inventory, docs/API_CONTRACT.md | State machine, idempotency, stock, loyalty | 10A: đủ 49 cặp transition; 10C: unit race test qua; Payment idempotency core test qua | PostgreSQL race/rollback chưa chạy; 10B TV5, 10D TV6 |

## 4. Checklist
- [x] Kiểm kê thiết kế Stitch và dự án đích.
- [x] Khởi tạo frontend/backend, build và kiểm tra cấu hình Compose.
- [x] Trang menu, chi tiết, giỏ; build và test phép tính/luồng mock.
- [x] Auth thật với PostgreSQL, cookie session và phân quyền HTTP.
- [x] Checkout, kết quả, lịch sử, loyalty, Barista với adapter; build và test mock.
- [x] Chạy build, test mock/backend và cập nhật tài liệu.
- [x] Chạy PostgreSQL thật, migration/seed, auth HTTP E2E và Compose đầy đủ.
- [x] Kiểm tra Playwright trên desktop/mobile ở mock mode và API mode.

## 5. Công việc hiện tại
Mốc mới nhất TV4 ngày 2026-10-15: sửa lỗi checkout 500 do lệch tên relation `history`/`statusHistory`. Build/lint qua; chạy toàn bộ Jest trong Docker trên PostgreSQL tạm riêng: **146 tests pass, 0 skipped**, gồm 8 bài DB/HTTP thật. Đã kiểm chứng migration, rollback, race tồn kho, retry và POST 201/PENDING giá 45.000đ qua cookie auth. Đã cập nhật backend local; chờ xác nhận browser và các module của TV5/TV6, không nâng toàn bộ T10 lên VERIFIED_COMPLETE.
Sửa lỗi build Docker tiếp theo ngày 2026-10-15: bỏ UTF-8 BOM đầu schema gây P1012; validate/generate/build local và bước build Docker qua. Không thay đổi API/schema nghiệp vụ. T06/10A/10C vẫn chờ bộ kiểm thử PostgreSQL thật.
Ngày 2026-10-15, nhánh `feature/orders-and-inventory`: TV4 đã thêm schema/migration Orders, OrderItem/Topping snapshot, OrderStatusHistory; OrdersModule, InventoryModule, optimistic locking Product/Order; API khách và staff; hook discount và transition dùng chung transaction cho TV5/TV6. Checkout/REST adapter đã nối theo contract và thêm test. **T06, 10A, 10C vẫn IN_PROGRESS, không VERIFIED_COMPLETE**: máy hiện không có Docker CLI, PostgreSQL `localhost:5434/brewlite` không kết nối được. Bộ PostgreSQL tests được opt-in riêng để không nhầm test giả lập với bằng chứng DB thật. Chi tiết bằng chứng/lệnh chạy tại `docs/TESTING.md`; không triển khai thay Payments/Promotions/Loyalty của owner khác. Đoạn bên dưới là lịch sử mốc nền tảng trước phần TV4.

Cấu trúc thư mục hiện hành và vị trí từng chức năng đã được ghi trong `docs/PROJECT_STRUCTURE.md` để nhóm và giảng viên tra cứu từ README.

Đã xử lý CORS cho trường hợp frontend chạy thêm tại `localhost:3002`: backend đọc danh sách `FRONTEND_ORIGIN` phân tách bằng dấu phẩy cho cả CORS và cookie origin guard. Cấu hình Compose lấy giá trị từ `.env`; cần build lại backend sau khi cập nhật mã. Kiểm tra trong `docs/TESTING.md`.

Đã đối chiếu cả 9 export Stitch; trang hồ sơ và Barista KDS được làm lại trong lượt TV1 2026-10-16. Browser QA kiểm tra các trang chính, giỏ, checkout, payment failure và 5 view Barista ở 1440/768/390 không tràn; E2E demo 4/4. Payment frontend giữ phương thức khi retry, xử lý UNKNOWN và không tự PAID. So sánh nghiệp vụ với backend thật vẫn chờ TV4–TV6.

Đã triển khai Next.js 13 static route cùng view động, auth/Products/Cart backend, adapter mock/REST, Dockerfile/Compose, docs và Git. Payment backend có core service/controller/DTO, mock gateway, Prisma Payment schema/migration, idempotency claim và test HTTP/service; backend hiện 59 tests, frontend 8 unit tests và build qua. DB QA đã áp dụng migration Auth mới; Payment endpoint vẫn chưa chạy E2E vì OrdersModule/`PAYMENT_ORDER_PORT` chưa có và `PaymentsModule` chưa đăng ký vào AppModule. Bước kế tiếp: TV4 cung cấp Orders/Staff + port, TV5 bật module/chạy Payment E2E, TV6 tích hợp Promotion/Loyalty/History.

## 6. Sở hữu nhóm
- TV1 Lead: kiến trúc frontend, toàn bộ UI, auth full stack, JWT, tài liệu, hạ tầng.
- TV2: backend products, catalog, tồn kho.
- TV3: tùy chọn sản phẩm, use case giỏ, nhất quán giá.
- TV4: backend orders, state machine, concurrency và inventory.
- TV5: backend payments, mock gateway, idempotency.
- TV6: backend order history, promotions, loyalty, hỗ trợ E2E.
