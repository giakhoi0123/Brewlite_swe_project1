# Kế hoạch triển khai BrewLite 1.0

## TV4 — kho nguyên vật liệu — 2026-10-28

Đã triển khai mở rộng T06/10C theo yêu cầu mới: Ingredient, công thức mỗi size/topping, snapshot nguyên liệu theo Order, giữ/hoàn/retry transaction + optimistic locking, API nhân viên và availability catalog. [Thiết kế, API và giới hạn](INGREDIENT_INVENTORY.md). PostgreSQL riêng: **16 migrations, 28 suites/335 tests PASS, 0 skipped**; frontend **23/23**, backend full test typecheck PASS. Database local đã migrate/seed 17 nguyên liệu, 30 size, 2 topping; giữ nguyên ba đơn lịch sử.

Phần triển khai backend đã kiểm thử; không nâng toàn bộ T06/T10 hoặc dự án lên VERIFIED_COMPLETE. TV2/TV4 cần xác nhận công thức thực tế thay số liệu minh họa. Contract vẫn một phần cho mỗi topping được chọn trên mỗi ly; không có UI nhập kho hoặc số phần lặp cùng topping. Công thức hiện chưa phụ thuộc tỷ lệ đá/đường. Product stock tiếp tục là giới hạn bán bổ sung. Migration Promotion bổ sung chỉ hiện thực model có sẵn; không đổi owner/logic TV6. Checksum migration Orders local cũ giữ nguyên sau đối chiếu schema, không reset lịch sử.

## Căn cứ viết báo cáo Assignment 1 — 2026-10-27

[ASSIGNMENT1_REQUIREMENTS.md](ASSIGNMENT1_REQUIREMENTS.md) lưu yêu cầu từ đề gốc và phân biệt với báo cáo nhóm tại main `2c45463`. Khi soạn báo cáo, đối chiếu 10 task/DoD và bằng chứng hiện hành, đặc biệt Task 8 Ví/Thẻ mock, Task 9 E2E, Task 10 và NFR < 500 ms. Đây là công việc đọc/ghi nhớ tài liệu; chưa sửa payment, phân công hoặc nâng trạng thái task. Task Assignment 1 không dùng chung mã với Task 1–5 Assignment 2.

## Assignment 2 — hồ sơ dữ liệu ngữ cảnh cho AI — 2026-10-24

Tệp ngữ cảnh hoàn chỉnh bằng Markdown [BREWLITE_ASSIGNMENT2_COMPREHENSIVE_CONTEXT.md](assignment2/BREWLITE_ASSIGNMENT2_COMPREHENSIVE_CONTEXT.md) đã được tổng hợp để nạp trực tiếp vào các hệ thống AI (hoặc thành viên tra cứu nhanh). Bao gồm đề bài, quy tắc tuần tự, phân công 6 người, Prisma schema, API contracts, UC-CHK, khoảng trống kỹ thuật và quy tắc chỉ đạo cho AI.

## Assignment 2 — nguồn dữ liệu dùng chung — 2026-10-24

Nhóm có thể dùng [hồ sơ dữ liệu tổng hợp một file](assignment2/BrewLite_Assignment2_Ho_so_du_lieu_nhom.docx) để tra cứu yêu cầu, phân công, scope/FR/NFR đề xuất, UC-CHK, schema/API, nguồn kiểm thử và checklist delivery. Thứ tự tiếp theo vẫn là chốt scope/SRS/FR → review UC và sơ đồ → nghiệm thu Task 1 → Task 2–5 theo đề. Hồ sơ phân biệt code hiện có, bằng chứng cũ và phần cần làm (đặc biệt health, CI/CD, production, hai lớp domain Promotion/LoyaltyTransaction); không thay thế các tạo phẩm riêng có lịch sử commit và bằng chứng thực tế.

## Assignment 2 — Task 1.3 theo phân công mới — 2026-10-24

Đã soạn [UC-CHK — Đặt và thanh toán đơn hàng](requirements/use-case-checkout.md) theo `Assignment2-BrewLite (2).pdf` mục 3.3 và `BrewLite_Phan_cong_6_thanh_vien.docx`: Điệp viết đặc tả, Duy phụ trách sơ đồ, Đông–Điệp review chéo. Có actor/trigger/điều kiện, 10 bước chính, 4 luồng thay thế, 8 ngoại lệ, quy tắc, 15 AC/test dự kiến và sơ đồ trọng tâm đề xuất (PlantUML/SVG). Trạng thái **DRAFT_READY_FOR_REVIEW**; bước tiếp theo là ghép mã FR/NFR với SRS Task 1.2, Duy/Đông review và chốt Q01–Q05 trong đặc tả. Chưa nghiệm thu toàn bộ Task 1 hoặc bắt đầu triển khai Task 2–5.

Các ghi chú phân công UC-CHK ngày 21/10 bên dưới là lịch sử; dùng DOCX vừa cung cấp cho phần Task 1.3. Không thay API, ứng dụng hoặc nhánh hiện tại; không dùng kết quả kiểm thử Assignment 1 để đánh dấu hoàn thành Assignment 2.

## Assignment 2 — Task 1 TV4 — 2026-10-21

Lộ trình Assignment 2 theo đề gồm 5 Task tuần tự, khác với bảng T01–T10 Assignment 1 phía dưới. [Bộ bàn giao TV4](assignment2/TV4_TASK1_HANDOFF.md) đã có bản yêu cầu, test plan và truy vết dự kiến, trạng thái **DRAFT_READY_FOR_REVIEW**. Mốc tiếp theo: nhóm review Q01–Q06, chốt scope/owner, ghép context/SRS/UC và diagram Task 1, commit/PR thật trước nghiệm thu Task 2. Chưa chuyển trạng thái hoàn thành cho Task 2–5; chưa quyết định di chuyển repo hoặc viết lại ứng dụng.

## Đồng bộ main vào nhánh Orders — 2026-10-26

Đã nhập `origin/main:2c45463` vào `feature/orders-and-inventory` từ nền `2ee0fc6`, giữ ba commit riêng TV4. Nhận cập nhật VNPAY/IPN/QueryDR, Promotions/Loyalty và giỏ Zustand. Giữ staff detail, customerName, completedAt chính xác và yêu cầu lý do hủy 1–300 ký tự; dùng ma trận main mới cho phép hủy PREPARING. Loại khai báo trùng do merge và nhận việc main thay bộ test Payment mock bằng VNPAY.

Prisma generate, build backend, frontend production build Webpack PASS; frontend unit **23/23**, backend Jest **262 PASS / 54 skipped (5 suite DB opt-in)**. Frontend lint PASS. Backend lint không lỗi, có 3 warning từ main. Full backend test typecheck còn 5 lỗi tại payments.service.spec.ts, vnpay.gateway.spec.ts và test/payments.e2e-spec.ts; cả ba file giống origin/main, không nằm trong phần giải quyết conflict. Không đánh dấu VERIFIED_COMPLETE hoặc dùng kết quả này xác nhận E2E/DB.

Docker daemon không chạy; chưa chạy PostgreSQL/migration/E2E và không thay dữ liệu hay cấu hình `.env` local. Hai nhánh cùng thêm cancel_reason, nên migration Loyalty dùng ADD COLUMN IF NOT EXISTS sau migration staff TV4; database đã áp Loyalty bản gốc cần đối chiếu checksum/lịch sử và schema trước triển khai. Xem API_CONTRACT.md. Runner browser TV4 cũ dùng mock payment chỉ còn là bằng chứng lịch sử, cần cập nhật cho VNPAY trước khi chạy lại.

Thay đổi local trước merge được lưu bằng stash `codex-before-main-update-2026-10-26` để khôi phục sau merge; không đưa tài liệu Assignment 2 chưa commit của người dùng vào merge commit.

## Tích hợp main vào VNPAY — 2026-10-22

Đã nhập `origin/main:cff6ff0`, giữ các module Auth/Orders/Promotions/Loyalty mới và giải xung đột theo contract VNPAY bất đồng bộ. Kiểm chứng hiện hành: backend build/lint, 20 suite/253 test không-DB, backend E2E 6 suite/126 test, frontend 20/20 unit + lint + build và Payment PostgreSQL 7 suite/101 test trên database tạm với đủ 13 migration đều PASS. Lỗi cộng Loyalty hai lần khi finalize `PAID` đã được bắt bằng PostgreSQL và sửa để Orders là owner duy nhất của increment. T08/10B vẫn **IN_PROGRESS** cho tới khi có bằng chứng callback IPN HTTPS thật.

## VNPAY-QR — 2026-10-21

Đã thay gateway mock bằng VNPAY WebPay 2.1.0 cho môi trường TEST: backend tạo URL HMAC-SHA512, Return chỉ điều hướng, IPN public HTTPS là nguồn chốt Payment/Order chính và QueryDR có chữ ký là fallback khi IPN trễ/mất. `VNPAY_BANK_CODE` là biến backend tùy chọn và mặc định để trống trong file mẫu; ngày 2026-10-22 VNPAY đã xác nhận active QR cho terminal TEST hiện tại nên `.env` local dùng `VNPAYQR`. Frontend bỏ chọn kết quả demo, chuyển sang trang hosted của VNPAY và chờ trạng thái backend đã xác minh. Cấu hình secret chỉ nằm backend; Docker frontend không còn nhận root `.env`.

Mã và kiểm tra đã cập nhật ngày 2026-10-22: backend 191 test + build/lint, frontend 19 unit + typecheck/build/lint phạm vi, Compose config và QA 1440/768/390 đều PASS. Compose đang chạy đủ ba service và migration VNPAY đã áp dụng. Giao dịch Sandbox bằng tài khoản TEST đã được QueryDR xác minh và lưu DB `PAID` cho Order `66e28a10-a95e-45ee-b877-a1617e9c3abf` (`vnp_TransactionNo=15711511`, `NCB`, pay date `20261022114118`, idempotency key `3998d99e-ff66-4ee6-a204-0a22cc35b60c`). T08/10B vẫn **IN_PROGRESS**, không nâng `VERIFIED_COMPLETE` cho tới khi cấu hình portal và kiểm chứng IPN HTTPS thật. Bộ credential ghi “môi trường TEST” không phải giao dịch production.

Luồng UI mới phân biệt Return read-only với trạng thái được backend xác minh: mã Return không thành công chỉ điều hướng tới `/payment/:id/unknown`, không mutate. Màn `verifying` gọi owner-auth `POST /payments/:orderId/reconcile` một lần, còn nút kiểm tra gọi lại QueryDR trước khi đọc Order. Từ màn UNKNOWN, `resumeOrder` replay cùng idempotency key/Payment PROCESSING và không tạo bản ghi mới; `retryOrder` với key mới chỉ dành cho Payment đã được IPN hoặc QueryDR finalize `PAYMENT_FAILED`.

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
| T05 | Giỏ | TV1+TV3 | VERIFIED_COMPLETE | T04 | frontend/src/stores | Thêm/sửa/xóa/tổng/badge; giỏ Zustand persist theo thiết kế ban đầu (2026-10-24 bỏ đồng bộ giỏ server) | 2026-10-24: 4 unit test store; frontend 23/23, lint, build; Playwright Edge API mode 16/16 (gộp cấu hình, đổi size, tăng/xóa, reload, đăng ký giữ giỏ, `POST /orders` 201 tổng server = UI, 0 request `/cart`, 1440/768/390 không tràn) | Backend `/cart` (TV3) còn nhưng frontend không dùng; gỡ hẳn cần TV4/TV5 đồng ý |
| T06 | Orders API | TV4 | IN_PROGRESS | Auth, products | backend/src/orders, backend/src/inventory | POST /orders PENDING | Sau merge: 18 suites/168 tests PASS trên PostgreSQL tạm gồm Orders HTTP, concurrency/rollback | Payment/Promotion và E2E trình duyệt API mode |
| T07 | Auth | TV1 | VERIFIED_COMPLETE (module Auth TV1) | DB | backend/src/auth, frontend/src/app/login, frontend/src/app/register | Đăng ký/nhập/JWT/guard/logout | Sau merge: 168/168 backend tests; HTTP QA cookie cũ 401 sau logout; Playwright role/redirect trước merge qua | Áp migration Auth trên DB nhóm |
| T08 | Payment | TV1+TV5 | IN_PROGRESS | T06 | frontend/src/services, frontend/src/app/payment, backend/src/payments, backend/prisma | VNPAY hosted, Return read-only, IPN chính + QueryDR fallback, resume idempotent | Sandbox TEST đã thanh toán; QueryDR/DB xác nhận PAID (`15711511`, NCB); backend 191 và frontend 19 test qua | Cấu hình IPN HTTPS trong portal và xác nhận callback IPN E2E; tiếp tục QA production config |
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
- TV5: backend payments, VNPAY WebPay/IPN, idempotency và reconciliation.
- TV6: backend order history, promotions, loyalty, hỗ trợ E2E.


## Lịch sử riêng nhánh TV4 trước khi nhập main ngày 2026-10-26

Các bằng chứng dưới đây thuộc code và gateway mock ở thời điểm ghi nhận, không xác nhận phiên bản VNPAY hiện tại.

## Nghiệm thu phạm vi TV4 theo báo cáo — 2026-10-18, mới nhất

T06/T10A/T10C và backend Barista **READY_FOR_REVIEW** trên `feature/orders-and-inventory`: đối chiếu US05/US10/US13–US16, UC14–17/UC28–32 với code. Đã bổ sung kiểm thử hai khách mua tồn kho cuối qua HTTP và hai lần bàn giao đồng thời; tổng 272/272 backend tests, 25 suites, 0 skipped, 11 migrations PostgreSQL PASS. Build/lint/typecheck backend PASS. Hai phiên browser thật chạy checkout→PAID→PREPARING→READY→COMPLETED tại 1440/768/390 PASS; hủy có lý do/lịch sử/detail được kiểm qua API thật.

Không còn chức năng backend TV4 mới được xác định từ báo cáo. TV1 còn bật UI hủy/history/KPI trong API mode và nghiệm thu B05 trên giao diện; TV5 giữ phạm vi Payment/refund, TV6 phối hợp history. Không đánh dấu toàn bộ Barista VERIFIED_COMPLETE. [Ma trận và bằng chứng TV4](TV4_ACCEPTANCE.md) thay các ghi chú “TV4 chưa có endpoint” ở lịch sử bên dưới.

## Backend Barista TV4 — 2026-10-16

Đã hoàn thành GET `/staff/orders/:id`, PATCH `/staff/orders/:id/cancel` bắt buộc lý do 1–300 ký tự, `cancelReason`/`completedAt` và danh sách staff gồm cả COMPLETED/CANCELLED. API status không chấp nhận CANCELLED để tránh bỏ qua lý do. Prisma generate, backend build local/Docker, lint và **19 suites/191 tests PASS**, gồm 22 bài PostgreSQL trên DB tạm riêng. Migration `20261016000100_staff_order_details` backfill thời điểm hoàn tất từ history thật. TV1 còn bật history/KPI/hủy trong API mode và chạy browser E2E; Payment/hoàn tiền thuộc TV5. Mốc này được giữ cùng các cập nhật Task 06/Payment mới hơn bên dưới.
