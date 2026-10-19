# BrewLite 1.0

> QA sau pull/merge `b87db13` ngày 19/10/2026: 9/9 user stories đạt nghiệm thu kỹ thuật trên PostgreSQL QA riêng; backend 301/301, E2E 185/185. Lượt cập nhật giao diện sau đó: frontend unit 16/16, Playwright auth/API menu 4/4. Xem [biên bản nghiệm thu](TEST_REPORT_BREWLITE.md). Compose cục bộ đã áp đủ 11 migrations; môi trường khác cần deploy migration `20261019000000_loyalty_log`. Gateway thật/hoàn tiền thật chưa được kiểm chứng.

> Mốc lịch sử Task 06 trước merge: code `2c8adc2` trên nhánh `feature/task-06-orders` đạt 247/247 backend tests và browser Orders API 4/4. Xem [bằng chứng cũ](docs/TASK06_REVIEW_VERIFICATION.md).

Ứng dụng đặt cà phê Việt và thanh toán không tiền mặt cho bài tập Công nghệ phần mềm nhóm 6 người. Gồm Next.js frontend, NestJS backend, PostgreSQL/Prisma và Docker Compose. Mã nguồn tập trung trong **`BrewLite_swe-project_1`**; `stitch/` chứa HTML và design tokens gốc cùng ảnh tham chiếu WebP đã nén.

## Phạm vi và hiện trạng

- Đã dựng 9 nhóm màn theo Stitch: menu, chi tiết/tùy chỉnh, giỏ, đăng ký/đăng nhập, checkout, xử lý/kết quả thanh toán, đơn hàng/theo dõi, hồ sơ/điểm, Barista.
- Auth là backend thật: đăng ký, đăng nhập, GET `/auth/me`, logout vô hiệu JWT cũ bằng `users.session_version`, bcrypt, cookie HttpOnly JWT, role CUSTOMER/BARISTA. Backend Products API và seed đã chạy trên PostgreSQL qua Compose; Products trả 10 sản phẩm.
- Orders/Inventory và Staff Orders đã có backend; API staff hỗ trợ danh sách, chuyển trạng thái và hủy có lý do. Payment đã nối Orders port và bật `POST /payments`. Mã ưu đãi mặc định được xác minh qua API và tính lại trong Order; phát hành voucher cá nhân chưa có. Gateway thanh toán vẫn là sandbox, không phải giao dịch tiền thật.
- Tiến độ 10 Task: `docs/IMPLEMENTATION_PLAN.md`; hợp đồng API: `docs/API_CONTRACT.md`.
- Barista KDS theo Stitch có 5 màn: `/barista/dashboard`, `/barista/orders`, `/barista/preparing`, `/barista/ready`, `/barista/history`. API mode lấy queue và lịch sử từ backend, chuyển trạng thái và hủy có lý do. Hồ sơ thành viên hiển thị điểm trong tài khoản; phát hành voucher cá nhân và chính sách đổi điểm chưa có.

## Cấu trúc

```text
frontend/   Next.js App Router, TypeScript, Tailwind, Zustand, service adapters
backend/    NestJS, Prisma migrations/seed, auth/role và Products API
stitch/     HTML, DESIGN.md gốc và ảnh tham chiếu screen.webp
docs/       kế hoạch, hợp đồng, kiến trúc, trạng thái, tích hợp, bàn giao, kiểm thử
```

`frontend/src/app` có route, `components` dùng chung, `stores/cart.ts` giữ giỏ sau refresh, `services` tách interface/mock/API, `types/domain.ts` chứa DTO UI. `backend/src/auth` và `backend/src/products` là module NestJS; `backend/prisma` là nguồn schema và migration.

Xem [cây thư mục đầy đủ và bản đồ chức năng](docs/PROJECT_STRUCTURE.md) để biết mỗi phần của dự án nằm ở đâu.

## Chuẩn bị

Cần Node.js 24, npm 11, Docker + Docker Compose (hoặc PostgreSQL 15 cài sẵn), Git. Nếu dùng Docker, khởi động Docker Desktop trước. Từ thư mục repo này:

```bash
cp .env.example .env
# Sửa POSTGRES_PASSWORD, DATABASE_URL và JWT_SECRET trong .env
npm --prefix frontend ci
npm --prefix backend ci
```

Giữ `DATABASE_URL` trùng mật khẩu và cổng PostgreSQL trong `.env` (mặc định 5434 để không xung đột dự án BrewLite khác trên 5433). `.env` không được commit. `BARISTA_PASSWORD` là mật khẩu tự đặt, không dùng giá trị mẫu khi chia sẻ môi trường. Khi chạy local, đặt `PORT=3001`, frontend mặc định cổng 3000.

Nếu Next.js chạy ở cổng khác, thêm địa chỉ đó vào `FRONTEND_ORIGIN` trong `.env`, phân tách bằng dấu phẩy (ví dụ `http://localhost:3000,http://localhost:3002`), rồi khởi động lại backend. Với Compose, chạy `docker compose up -d --build backend` để áp dụng thay đổi mã và cấu hình. Nếu thiếu origin, trình duyệt sẽ chặn API đăng ký/đăng nhập và hiện `Failed to fetch`.

### Chạy phát triển bằng PostgreSQL trong Docker

```bash
docker compose up -d postgres
set -a; source .env; set +a
npm --prefix backend run prisma:generate
npm run db:migrate
npm run db:seed
npm run dev:backend
# terminal khác
npm run dev:frontend
```

Mở `http://localhost:3000`. Backend là `http://localhost:3001/api`. `prisma:seed` tạo sản phẩm demo và tài khoản Barista khi `BARISTA_EMAIL`, `BARISTA_PASSWORD` có trong môi trường shell. Với backend chạy bằng npm, nạp biến từ `.env` trước seed, ví dụ `set -a; source .env; set +a; npm --prefix backend run prisma:seed` trong zsh. Lệnh seed idempotent, không đặt lại stock/giá sản phẩm đã có.

Nếu cài PostgreSQL riêng, tạo database `brewlite`, cập nhật `DATABASE_URL` và chạy các lệnh Prisma ở trên. Không chạy migration vào DB đang dùng bởi repo khác trước khi kiểm tra URL.

### Chạy cả ba dịch vụ với Compose

```bash
docker compose up --build
# terminal khác, sau khi DB và backend sẵn sàng
set -a; source .env; set +a; npm --prefix backend run prisma:seed
```

Lưu ý lệnh seed ở host dùng `DATABASE_URL` trỏ cổng host 5434. Frontend chạy cổng 3000, backend 3001, DB 5434. Frontend build mặc định ở API mode; khi đổi `NEXT_PUBLIC_*` cần build lại image.

## Chế độ dữ liệu

`NEXT_PUBLIC_DATA_MODE=api` là mặc định cho bản trình bày/nghiệm thu: sản phẩm, giỏ, đơn hàng, mã ưu đãi và thanh toán gọi REST/PostgreSQL; lỗi API không tự chuyển sang mock. Auth cũng luôn gọi NestJS/PostgreSQL; điểm thành viên được đọc từ `/auth/me`. Cổng thanh toán backend hiện là sandbox, chưa phải giao dịch tiền thật.

### Thành viên và tích điểm

Tài khoản CUSTOMER đăng ký ở `/register` **tự động là thành viên BrewLite**; hiện không có bước đăng ký Loyalty riêng. Khi đã đăng nhập, thẻ trên trang chủ dẫn đến `/profile` để xem điểm và lịch sử đơn. Điểm được cộng khi đơn chuyển sang `PAID`: `floor(tổng tiền sau giảm giá / 10.000)`, ghi trong PostgreSQL cùng `LoyaltyLog`; gửi lại cùng khóa thanh toán không cộng thêm lần nữa. Đơn chưa thanh toán hoặc thanh toán thất bại không nhận điểm. Hiện chưa có chức năng đổi điểm hay phát hành voucher cá nhân.

`NEXT_PUBLIC_DATA_MODE=mock` chỉ dùng khi chủ động kiểm thử giao diện, đặt trong `frontend/.env.local` hoặc `.env` rồi khởi động/build lại frontend. Mock lưu đơn và payment trong localStorage. Nếu cần bộ chọn kết quả PAID/FAILED/UNKNOWN khi kiểm thử, đặt thêm `NEXT_PUBLIC_PAYMENT_DEMO_CONTROLS=true`; mặc định giao diện không hiển thị bộ chọn. Mã `BREW10` chỉ áp dụng trong mock mode.

Bộ Playwright `frontend/e2e/flow.spec.ts` cần mock mode và bộ chọn kết quả thanh toán; bật thêm `BREWLITE_RUN_MOCK_E2E=1` khi chạy riêng bộ đó. Bộ kiểm thử API mode dùng `BREWLITE_RUN_API_E2E=1`.

`NEXT_PUBLIC_DATA_MODE=hybrid` dành cho kiểm thử tích hợp từng phần: sản phẩm và giỏ hàng gọi backend thật, đơn hàng/thanh toán/ưu đãi/điểm/Barista dùng mock. Đặt trong `frontend/.env.local` cùng `NEXT_PUBLIC_API_URL=http://localhost:3001/api`, cần backend + DB đã chạy `npm run db:migrate`. Khách chưa đăng nhập giữ giỏ trong trình duyệt và được gộp lên server khi đăng nhập.

Orders/Inventory/Payments cần áp dụng đủ migration trước khi chạy API mode. Nếu thay `NEXT_PUBLIC_*`, khởi động lại hoặc build lại frontend. Tạo đơn PENDING chưa đồng nghĩa thanh toán thành công: chỉ `POST /payments` PAID mới chuyển Order sang PAID; UNKNOWN giữ Order hiện tại.

Để kiểm thử ba phản hồi gateway qua giao diện API mode, đặt đồng thời `PAYMENT_DEMO_CONTROLS=true` cho backend và `NEXT_PUBLIC_PAYMENT_DEMO_CONTROLS=true` khi build frontend. Sau khi thêm món và đăng nhập, tới checkout rồi bấm **Kiểm thử thanh toán** dưới lựa chọn Ví điện tử/Thẻ ngân hàng. Chọn *Thành công*, *Thất bại* hoặc *Chưa xác định*, sau đó bấm **Xác nhận thanh toán** trong tóm tắt đơn hàng. Có thể mở trực tiếp `http://localhost:3000/checkout?qa=1`; nút ẩn lại phần kiểm thử khi bấm lần nữa. Bản cục bộ hiện đã bật hai cờ trong `.env` chỉ để nghiệm thu; khi triển khai thật phải để cả hai `false`, khi đó nút không xuất hiện. Backend bỏ qua `demoOutcome` khi cờ backend tắt. Ví điện tử/thẻ ngân hàng hiện chỉ là hai phương thức ghi nhận trong mock gateway; không có QR, nhập thẻ hoặc trừ tiền thật.

Kết quả PAID chuyển đơn sang PAID, xóa giỏ và cộng điểm một lần; PAYMENT_FAILED giữ giỏ và cho thanh toán lại **cùng đơn**; UNKNOWN giữ đơn ở PENDING để chờ đối soát, không được tự thử thanh toán mới vì chưa biết giao dịch đã trừ tiền hay chưa. Cả ba trạng thái có bài browser API `frontend/e2e/payment-outcomes-api.spec.ts` và PostgreSQL/Jest trong biên bản nghiệm thu.


Để chạy hai bài E2E API mode: `docker compose stop frontend`, chạy `NEXT_PUBLIC_DATA_MODE=api NEXT_PUBLIC_API_URL=http://localhost:3001/api npm --prefix frontend run dev -- --port 3000` ở terminal riêng; sau đó chạy `BREWLITE_RUN_API_E2E=1 npm --prefix frontend run test:e2e -- --grep "API mode"`. Dừng Next dev và chạy `docker compose start frontend` để trả lại demo mode.

## Auth và Barista

Đăng ký công khai luôn tạo CUSTOMER. Đăng nhập dùng chung; BARISTA được chuyển tới `/barista/dashboard`; CUSTOMER bị chặn khỏi màn đó. Trình duyệt giữ cookie HttpOnly, SameSite=Lax, Secure ở production; không lưu JWT ở localStorage. Logout tăng `session_version` trong PostgreSQL rồi xóa cookie, làm hết hiệu lực **mọi** phiên của tài khoản. Migration `20261016000000_session_version` phải được áp dụng bằng `npm run db:migrate` trước khi khởi động backend mới. Staff Orders API của TV4 đã có list/transition với guard role; phần còn thiếu ghi trong `docs/API_CONTRACT.md`.

Để thử Customer và Barista đồng thời, dùng **hai hồ sơ trình duyệt độc lập** (ví dụ cửa sổ thường và cửa sổ riêng tư, hoặc hai trình duyệt). Hai tab cùng hồ sơ chia sẻ cookie `brewlite_session`; đăng nhập vai trò thứ hai sẽ thay phiên của tab đầu. Hiện chưa có chức năng khôi phục mật khẩu qua email. Bài browser `auth-session-api.spec.ts` xác minh đăng ký → đăng xuất → đăng nhập lại và hai browser context riêng.

Để tạo tài khoản Barista cục bộ, đặt `BARISTA_EMAIL` và `BARISTA_PASSWORD` trong `.env`, rồi nạp `.env` vào shell và chạy:

```bash
set -a; source .env; set +a
npm --prefix backend run prisma:seed
```

Seed không tạo Barista trong `NODE_ENV=production`; không có endpoint đăng ký staff công khai. Đừng commit thông tin tài khoản thật.

## Scripts và kiểm thử

```bash
npm run dev:frontend
npm run dev:backend
npm run build
npm run lint
npm run test
npm --prefix frontend run build
npm --prefix backend run build
npm --prefix backend test -- --runInBand
# Khi đã chạy Compose và cài Chromium:
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e -- auth-presentation.spec.ts
BREWLITE_RUN_API_E2E=1 npm --prefix frontend run test:e2e -- --grep "API mode"
```

Lượt nối Payment–Order 2026-10-17: Prisma generate, backend build/lint và **18 suites/165 tests PASS** cho bộ không cần DB; **2 suite/18 test PostgreSQL Payment PASS** trên DB tạm đã áp đủ 9 migration. HTTP smoke tạo Order→Payment trả PAID và truy vấn trực tiếp xác nhận bản ghi Order/Payment cùng hai dòng status history. Browser API đã kiểm tra PAYMENT_FAILED → quay lại checkout → PAID trên cùng order; DB có một Order và hai Payment theo đúng thứ tự. Browser API E2E mở rộng vẫn còn chờ.

## Nhóm, branch và PR

Cập nhật TV4 2026-10-15: Prisma generate/validate, build/lint hai phía, 138 backend tests và 8 frontend tests qua. Bảy PostgreSQL tests chưa chạy: máy không có Docker CLI và DB `localhost:5434/brewlite` từ chối kết nối. Migration Orders được tạo offline, chưa apply; chưa VERIFIED_COMPLETE. Xem `docs/TESTING.md` để chạy lại trên DB kiểm thử riêng. Các số liệu Compose/E2E ở phần trên là bằng chứng của mốc nền tảng trước đó, không xác nhận Orders mới.

TV1 duy trì kiến trúc, UI, auth và docs; TV2 Products; TV3 options/cart; TV4 Orders/inventory/state machine; TV5 Payments/idempotency; TV6 Promotions/Loyalty/History/E2E. Chi tiết ở `docs/TEAM_HANDOFF.md`. Nhánh `feature/auth-and-base` chứa nền tảng dự án và phần auth; các thành viên tạo branch `feature/products`, `feature/orders`, `feature/payments`, `feature/loyalty`, `feature/barista` từ nhánh tích hợp do nhóm thống nhất. PR phải nêu thay đổi DTO, test và cập nhật docs.

## Đọc tiếp

Bắt đầu với `docs/PROJECT_STRUCTURE.md`, `docs/PROJECT_CONTEXT.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, rồi `docs/INTEGRATION_GUIDE.md`. Trạng thái hiện hành ở `docs/PROJECT_STATUS.md`. Hạn chế sản phẩm còn lại: gateway thanh toán thật, hoàn tiền thật, phát hành voucher cá nhân và đổi điểm chưa triển khai; ảnh gốc Stitch cần mạng (có SVG dự phòng offline). Các đoạn bàn giao Task cũ trong tài liệu là mốc lịch sử.
