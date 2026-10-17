# BrewLite 1.0

> Task 06 đã hoàn thiện và kiểm chứng trên nhánh `codex/task-06-orders` từ main `c2d6922`: 201 backend tests PostgreSQL thật và 4 browser API E2E PASS. Xem [ma trận nghiệm thu, commit, bằng chứng và lệnh chạy lại](docs/TASK06_VERIFICATION.md). Chờ review PR của nhóm; Task 08/09/10 theo dõi riêng. Các ghi chú lịch sử bên dưới có thể chưa phản ánh phần Payment/Promotion vừa nhập từ PR #12.

Ứng dụng đặt cà phê Việt và thanh toán không tiền mặt cho bài tập Công nghệ phần mềm nhóm 6 người. Gồm Next.js frontend, NestJS backend, PostgreSQL/Prisma và Docker Compose. Mã nguồn tập trung trong **`BrewLite_swe-project_1`**; `stitch/` chứa HTML và design tokens gốc cùng ảnh tham chiếu WebP đã nén.

## Phạm vi và hiện trạng

- Đã dựng 9 nhóm màn theo Stitch: menu, chi tiết/tùy chỉnh, giỏ, đăng ký/đăng nhập, checkout, xử lý/kết quả thanh toán, đơn hàng/theo dõi, hồ sơ/điểm, Barista.
- Auth là backend thật: đăng ký, đăng nhập, GET `/auth/me`, logout vô hiệu JWT cũ bằng `users.session_version`, bcrypt, cookie HttpOnly JWT, role CUSTOMER/BARISTA. Backend Products API và seed đã chạy trên PostgreSQL qua Compose; Products trả 10 sản phẩm.
- Orders/Inventory và Staff Orders cơ bản đã có backend TV4 trên `main`; DB PostgreSQL và test nghiệp vụ đã được TV4 xác minh. API staff hiện có danh sách và chuyển trạng thái; chi tiết riêng, hủy có lý do và lịch sử staff còn chờ mở rộng. Payment đã nối Orders port và bật `POST /payments`; migration ràng buộc `payments.order_id → orders.id` và 2 suite/18 test PostgreSQL Payment đã qua. Promotions chưa hoàn chỉnh; gateway thanh toán vẫn là mock, không phải giao dịch tiền thật.
- Tiến độ 10 Task: `docs/IMPLEMENTATION_PLAN.md`; hợp đồng API: `docs/API_CONTRACT.md`.
- Barista KDS theo Stitch có 5 màn: `/barista/dashboard`, `/barista/orders`, `/barista/preparing`, `/barista/ready`, `/barista/history`. Mock chia sẻ dữ liệu với lịch sử khách hàng; API mode dùng backend TV4 cho queue/transition nhưng history và hủy có lý do còn chờ endpoint. Hồ sơ thành viên chưa phát hành voucher hoặc chính sách đổi điểm.

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

Lưu ý lệnh seed ở host dùng `DATABASE_URL` trỏ cổng host 5434. Frontend chạy cổng 3000, backend 3001, DB 5434. Dockerfile frontend build mặc định mode mock; khi đổi mode cần build lại image.

## Chế độ dữ liệu

`NEXT_PUBLIC_DATA_MODE=mock` (mặc định) cho sản phẩm/đơn/thanh toán/ưu đãi/điểm/Barista. Có thể đặt trong `frontend/.env.local` khi phát triển local. Mock lưu đơn và payment trong localStorage, trả lỗi rõ ràng, có lựa chọn kết quả PAID/FAILED/UNKNOWN ở checkout. Auth **luôn** gọi NestJS/PostgreSQL, nên vẫn cần backend+DB khi demo đầy đủ. Dùng mã demo `BREW10` để thử ưu đãi; quy tắc này không phải chính sách thật.

`NEXT_PUBLIC_DATA_MODE=hybrid` (khuyên dùng khi phát triển local): sản phẩm và giỏ hàng gọi backend thật, nên thêm/sửa/xóa giỏ của người đã đăng nhập được lưu vào PostgreSQL (bảng `carts`, `cart_items`); đơn hàng/thanh toán/ưu đãi/điểm/Barista vẫn mô phỏng để demo trọn luồng trong lúc Payment/Promotion/Loyalty chưa hoàn thiện. Đặt trong `frontend/.env.local` cùng `NEXT_PUBLIC_API_URL=http://localhost:3001/api`, cần backend + DB đã chạy `npm run db:migrate`. Khách chưa đăng nhập giữ giỏ trong trình duyệt và được gộp lên server khi đăng nhập.

`NEXT_PUBLIC_DATA_MODE=api` gọi REST cho mọi module; Orders/Inventory/Payments đã có backend và cần áp dụng đủ migration trước khi chạy. Lỗi API không tự fallback sang mock. Nếu thay `NEXT_PUBLIC_*`, khởi động lại hoặc build lại frontend. Tạo đơn PENDING chưa đồng nghĩa thanh toán thành công: chỉ `POST /payments` PAID mới chuyển Order sang PAID; UNKNOWN giữ Order hiện tại.

Để giữ bộ chọn “Kịch bản demo” trong API mode mà vẫn ghi Order/Payment vào PostgreSQL, chỉ ở môi trường sandbox đặt đồng thời `PAYMENT_DEMO_CONTROLS=true` cho backend và `NEXT_PUBLIC_PAYMENT_DEMO_CONTROLS=true` khi build frontend. Production phải để hai cờ này `false`; request tự chọn outcome khi backend không bật cờ sẽ bị bỏ qua.


Để chạy hai bài E2E API mode: `docker compose stop frontend`, chạy `NEXT_PUBLIC_DATA_MODE=api NEXT_PUBLIC_API_URL=http://localhost:3001/api npm --prefix frontend run dev -- --port 3000` ở terminal riêng; sau đó chạy `BREWLITE_RUN_API_E2E=1 npm --prefix frontend run test:e2e -- --grep "API mode"`. Dừng Next dev và chạy `docker compose start frontend` để trả lại demo mode.

## Auth và Barista

Đăng ký công khai luôn tạo CUSTOMER. Đăng nhập dùng chung; BARISTA được chuyển tới `/barista/dashboard`; CUSTOMER bị chặn khỏi màn đó. Trình duyệt giữ cookie HttpOnly, SameSite=Lax, Secure ở production; không lưu JWT ở localStorage. Logout tăng `session_version` trong PostgreSQL rồi xóa cookie, làm hết hiệu lực **mọi** phiên của tài khoản. Migration `20261016000000_session_version` phải được áp dụng bằng `npm run db:migrate` trước khi khởi động backend mới. Staff Orders API của TV4 đã có list/transition với guard role; phần còn thiếu ghi trong `docs/API_CONTRACT.md`.

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
npm --prefix frontend run test:e2e -- --grep-invert "API mode"
```

Lượt nối Payment–Order 2026-10-17: Prisma generate, backend build/lint và **18 suites/165 tests PASS** cho bộ không cần DB; **2 suite/18 test PostgreSQL Payment PASS** trên DB tạm đã áp đủ 9 migration. HTTP smoke tạo Order→Payment trả PAID và truy vấn trực tiếp xác nhận bản ghi Order/Payment cùng hai dòng status history. Browser API đã kiểm tra PAYMENT_FAILED → quay lại checkout → PAID trên cùng order; DB có một Order và hai Payment theo đúng thứ tự. Browser API E2E mở rộng vẫn còn chờ.

## Nhóm, branch và PR

Cập nhật TV4 2026-10-15: Prisma generate/validate, build/lint hai phía, 138 backend tests và 8 frontend tests qua. Bảy PostgreSQL tests chưa chạy: máy không có Docker CLI và DB `localhost:5434/brewlite` từ chối kết nối. Migration Orders được tạo offline, chưa apply; chưa VERIFIED_COMPLETE. Xem `docs/TESTING.md` để chạy lại trên DB kiểm thử riêng. Các số liệu Compose/E2E ở phần trên là bằng chứng của mốc nền tảng trước đó, không xác nhận Orders mới.

TV1 duy trì kiến trúc, UI, auth và docs; TV2 Products; TV3 options/cart; TV4 Orders/inventory/state machine; TV5 Payments/idempotency; TV6 Promotions/Loyalty/History/E2E. Chi tiết ở `docs/TEAM_HANDOFF.md`. Nhánh `feature/auth-and-base` chứa nền tảng dự án và phần auth; các thành viên tạo branch `feature/products`, `feature/orders`, `feature/payments`, `feature/loyalty`, `feature/barista` từ nhánh tích hợp do nhóm thống nhất. PR phải nêu thay đổi DTO, test và cập nhật docs.

## Đọc tiếp

Bắt đầu với `docs/PROJECT_STRUCTURE.md`, `docs/PROJECT_CONTEXT.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, rồi `docs/INTEGRATION_GUIDE.md`. Trạng thái hiện hành ở `docs/PROJECT_STATUS.md`. Hạn chế chính: Orders/Inventory còn chờ DB verification; Payment chờ Orders port để kích hoạt và migrate; backend Promotions/Loyalty còn thiếu; ảnh gốc Stitch cần mạng (có SVG dự phòng offline). Bằng chứng PostgreSQL/Compose và Playwright cũ không áp dụng cho migration Orders mới.
