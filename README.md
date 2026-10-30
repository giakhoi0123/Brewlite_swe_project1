# BrewLite 1.0

Ứng dụng đặt cà phê Việt và thanh toán không tiền mặt cho bài tập Công nghệ phần mềm nhóm 6 người. Gồm Next.js frontend, NestJS backend, PostgreSQL/Prisma và Docker Compose. Mã nguồn tập trung trong **`BrewLite_swe-project_1`**; `stitch/` chứa HTML và design tokens gốc cùng ảnh tham chiếu WebP đã nén.

## Phạm vi và hiện trạng

- Đã dựng 9 nhóm màn theo Stitch: menu, chi tiết/tùy chỉnh, giỏ, đăng ký/đăng nhập, checkout, xử lý/kết quả thanh toán, đơn hàng/theo dõi, hồ sơ/điểm, Barista.
- Auth là backend thật: đăng ký, đăng nhập, GET `/auth/me`, logout vô hiệu JWT cũ bằng `users.session_version`, bcrypt, cookie HttpOnly JWT, role CUSTOMER/BARISTA. Khôi phục mật khẩu hoàn chỉnh: quên mật khẩu (`POST /api/auth/forgot-password`), đặt lại mật khẩu (`POST /api/auth/reset-password`), và đổi mật khẩu trong hồ sơ (`POST /api/auth/change-password`). Sử dụng bảng `PasswordResetToken` lưu SHA-256 hash của token ngẫu nhiên bảo mật 32 bytes, hạn 15 phút, dùng một lần duy nhất, tăng `sessionVersion` sau khi đổi mật khẩu để hủy các phiên cũ, rate limit chống lạm dụng và chống lộ thông tin tồn tại email. Backend Products API và seed đã chạy trên PostgreSQL qua Compose; Products trả 10 sản phẩm.
- Email Sandbox: Tích hợp Mailpit trong Docker Compose (cổng SMTP 1025, Web UI 8025 để kiểm tra email gửi đi trong môi trường phát triển/kiểm thử). `MailService` trừu tượng hóa gửi email qua SMTP; môi trường production yêu cầu cấu hình SMTP thật qua biến môi trường.
- Orders/Inventory và Staff Orders đã có backend TV4 trên `main`; API staff hỗ trợ danh sách, chuyển trạng thái và hủy có lý do. Khách hàng có endpoint tự hủy đơn `POST /api/orders/:id/cancel` cho đơn `PENDING` hoặc `PAYMENT_FAILED` (không được hủy đơn đang pha chế/hoàn tất). Dọn giỏ hàng sau khi thanh toán thành công chỉ xóa các món tương ứng trong đơn hàng (scoped cleanup), bảo toàn món mới thêm vào giỏ trong lúc chờ thanh toán.
- Thanh toán chính thức: Triển khai bằng VNPAY Sandbox (WebPay 2.1.0) theo đúng yêu cầu giảng viên; tuyệt đối không bổ sung thanh toán Wallet/Card giả lập. Backend ký HMAC-SHA512, ưu tiên IPN và dùng QueryDR có chữ ký làm fallback khi IPN bị trễ/mất; kết quả hợp lệ cập nhật Payment/Order trong transaction atomic. `VNPAY_BANK_CODE` là cấu hình backend tùy chọn; mặc định để trống để trang hosted hiển thị các phương thức terminal được cấp.
- Vouchers & Loyalty: Khắc phục triệt để lỗ hổng client tự gửi `discountAmount`. Client chỉ gửi `rewardId` qua `POST /api/loyalty/redeem`; backend tự động xác thực điểm, khấu trừ và sinh `Voucher` trong PostgreSQL gắn với `userId`. Quản lý vòng đời `AVAILABLE` → `RESERVED` → `REDEEMED`, tự động giải phóng voucher khi đơn thất bại/hủy. Giao diện hồ sơ tải danh sách voucher cá nhân trực tiếp từ `GET /api/loyalty/vouchers`, không dùng localStorage làm nguồn xác thực.
- Tiến độ 10 Task: `docs/IMPLEMENTATION_PLAN.md`; hợp đồng API: `docs/API_CONTRACT.md`.
- Barista KDS theo Stitch có 5 màn: `/barista/dashboard`, `/barista/orders`, `/barista/preparing`, `/barista/ready`, `/barista/history`. API mode dùng backend TV4 cho queue/transition; endpoint history/hủy có lý do đã có, TV1 còn bật các nhánh UI tương ứng và KPI. Hồ sơ thành viên chưa phát hành voucher hoặc chính sách đổi điểm.

## Cấu trúc

```text
frontend/   Next.js App Router, TypeScript, Tailwind, Zustand, service adapters
backend/    NestJS, Prisma migrations/seed, auth/role và Products API
stitch/     HTML, DESIGN.md gốc và ảnh tham chiếu screen.webp
docs/       kế hoạch, hợp đồng, kiến trúc, trạng thái, tích hợp, bàn giao, kiểm thử
```

`frontend/src/app` có route, `components` dùng chung, `stores/cart.ts` giữ giỏ trong localStorage (Zustand persist, không đồng bộ server; checkout gửi items trong `POST /orders`), `services` tách interface/mock/API, `types/domain.ts` chứa DTO UI. `backend/src/auth` và `backend/src/products` là module NestJS; `backend/prisma` là nguồn schema và migration.

Xem [cây thư mục đầy đủ và bản đồ chức năng](docs/PROJECT_STRUCTURE.md) để biết mỗi phần của dự án nằm ở đâu.

## Chuẩn bị

Cần Node.js 24, npm 11, Docker + Docker Compose (hoặc PostgreSQL 15 cài sẵn), Git. Nếu dùng Docker, khởi động Docker Desktop trước. Từ thư mục repo này:

```bash
cp .env.example .env
# Sửa POSTGRES_PASSWORD, DATABASE_URL, JWT_SECRET và cấu hình VNPAY trong .env
npm --prefix frontend ci
npm --prefix backend ci
```

Giữ `DATABASE_URL` trùng mật khẩu và cổng PostgreSQL trong `.env` (mặc định 5434 để không xung đột dự án BrewLite khác trên 5433). `.env` không được commit. `BARISTA_PASSWORD` là mật khẩu tự đặt, không dùng giá trị mẫu khi chia sẻ môi trường. Khi chạy local, đặt `PORT=3001`, frontend mặc định cổng 3000.

VNPAY cần `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_QUERY_URL`, `VNPAY_QUERY_IP_ADDRESS`, `VNPAY_RETURN_URL` và `FRONTEND_PUBLIC_URL`. `VNPAY_QUERY_URL` là API QueryDR tương ứng với môi trường VNPAY; `VNPAY_QUERY_IP_ADDRESS` là địa chỉ IP server gửi trong request truy vấn. `VNPAY_BANK_CODE` là biến backend tùy chọn: để trống theo mặc định để VNPAY hiển thị các phương thức mà terminal được cấp, chỉ đặt `VNPAYQR` sau khi VNPAY xác nhận đã bật kênh QR cho merchant TEST. `VNPAY_HASH_SECRET` chỉ được đặt ở backend, không dùng biến `NEXT_PUBLIC_*` và không commit. Với môi trường TEST có thể dùng URL sandbox trong `.env.example`; môi trường thật phải dùng đúng URL/credential VNPAY bàn giao, không tự suy đoán URL production.

### Đăng ký tài khoản Merchant VNPAY Sandbox

1. Truy cập [Đăng ký Merchant môi trường TEST](https://sandbox.vnpayment.vn/devreg), nhập tên website, URL website, email, mật khẩu và mã xác nhận. Nếu dự án chưa deploy, có thể dùng URL HTTPS do ngrok tạo ở mục kế tiếp.
2. Gửi biểu mẫu, kiểm tra email và lấy `vnp_TmnCode` cùng `vnp_HashSecret` VNPAY gửi cho tài khoản TEST. Tài khoản/credential này chỉ dùng cho Sandbox, không phải tài khoản production.
3. Sao chép `.env.example` thành `.env`, rồi cấu hình các giá trị sau. Không commit `.env`, không gửi `VNPAY_HASH_SECRET` lên frontend và không đăng credential thật vào issue/log.

```dotenv
VNPAY_TMN_CODE=<TmnCode nhận từ VNPAY>
VNPAY_HASH_SECRET=<HashSecret nhận từ VNPAY>
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_QUERY_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_QUERY_IP_ADDRESS=<IPv4 của máy/server gửi QueryDR>
VNPAY_RETURN_URL=https://<ngrok-domain>/api/payments/vnpay/return
VNPAY_BANK_CODE=
FRONTEND_PUBLIC_URL=http://localhost:3000
```

`VNPAY_QUERY_IP_ADDRESS` là IPv4 công khai mà tiến trình backend thực sự dùng để gọi QueryDR, không phải URL ngrok, `127.0.0.1` hay IP mạng nội bộ. Có thể kiểm tra IP egress từ chính container backend; khi đổi mạng/VPN phải cập nhật `.env` và recreate backend. Để `VNPAY_BANK_CODE` trống nếu terminal TEST chưa được VNPAY bật QR; chỉ đặt `VNPAY_BANK_CODE=VNPAYQR` sau khi VNPAY xác nhận đã cấp kênh này.

### Tạo URL HTTPS bằng ngrok cho Return/IPN

Backend phải đang chạy ở `http://localhost:3001` trước khi mở tunnel. Đăng ký/đăng nhập [tài khoản ngrok](https://dashboard.ngrok.com/signup) để lấy authtoken. Trên Windows có thể cài ngrok bằng WinGet; các hệ điều hành khác tải agent từ [trang cài đặt ngrok](https://ngrok.com/download):

```powershell
winget install ngrok -s msstore
ngrok config add-authtoken "<NGROK_AUTHTOKEN>"
ngrok http 3001
```

Lấy URL HTTPS trong dòng `Forwarding`, ví dụ `https://brewlite-example.ngrok-free.app`, rồi:

1. Đặt `VNPAY_RETURN_URL=https://brewlite-example.ngrok-free.app/api/payments/vnpay/return` trong `.env`.
2. Khai báo IPN trong cổng VNPAY/VSM là `https://brewlite-example.ngrok-free.app/api/payments/vnpay/ipn`.
3. Khởi động lại backend để nạp `.env`; nếu chạy Compose, dùng `docker compose up -d --build backend`.
4. Giữ cửa sổ `ngrok http 3001` mở trong suốt lúc test. Có thể xem request callback tại `http://localhost:4040` hoặc Traffic Inspector của ngrok.

Nếu domain ngrok thay đổi, phải cập nhật cả `VNPAY_RETURN_URL` và IPN đã khai báo trên VNPAY/VSM. Không thêm lớp Basic Auth/OAuth trước endpoint IPN vì VNPAY cần gọi trực tiếp. IPN phải dùng HTTPS và truy cập được từ Internet; `localhost` không nhận được callback server-to-server. IPN là nguồn xác nhận chính. Nếu IPN bị trễ/mất, endpoint owner-auth `POST /api/payments/:orderId/reconcile` gọi QueryDR và chỉ ghi trạng thái sau khi kiểm tra chữ ký, merchant, reference, loại giao dịch và số tiền. Return URL luôn read-only.

### Kiểm thử QR trên Sandbox

QR Sandbox không quét bằng ứng dụng ngân hàng thông thường/LIVE. Dùng ứng dụng QR TEST do VNPAY cung cấp cho terminal:

- iOS: [cài qua TestFlight](https://testflight.apple.com/join/cB9e74w7).
- Android: [tải từ Google Drive](https://drive.google.com/drive/folders/134q6yKTW8Gwy2ctAC7AQ9WEPLH1M_bui?usp=sharing).

Theo hướng dẫn VNPAY: đăng nhập bằng email, đăng ký số điện thoại để đăng nhập ứng dụng TEST, sau đó Merchant chủ động nạp số dư Sandbox vào ứng dụng trước khi quét QR. Tài khoản Merchant Sandbox và tài khoản ứng dụng QR TEST phục vụ hai bước khác nhau. Nếu link ứng dụng hết hạn, terminal chưa được bật QR hoặc chưa có quyền nạp tiền TEST, liên hệ đầu mối kỹ thuật VNPAY đã cấp merchant. Có thể dùng phương tiện/thẻ NCB TEST thay thế theo tài liệu VNPAY khi chưa kiểm thử QR được; không dùng tiền hoặc tài khoản ngân hàng thật.

Nếu Next.js chạy ở cổng khác, thêm địa chỉ đó vào `FRONTEND_ORIGIN` trong `.env`, phân tách bằng dấu phẩy (ví dụ `http://localhost:3000,http://localhost:3002`), rồi khởi động lại backend. Với Compose, chạy `docker compose up -d --build backend` để áp dụng thay đổi mã và cấu hình. Nếu thiếu origin, trình duyệt sẽ chặn API đăng ký/đăng nhập và hiện `Failed to fetch`.

### Chạy phát triển bằng PostgreSQL và Mailpit trong Docker

```bash
docker compose up -d postgres mailpit
set -a; source .env; set +a
npm --prefix backend run prisma:generate
npm run db:migrate
npm run db:seed
npm run dev:backend
# terminal khác
npm run dev:frontend
```

Mở `http://localhost:3000`. Backend là `http://localhost:3001/api`. Mailpit Web UI (kiểm tra email khôi phục mật khẩu) là `http://localhost:8025`. SMTP nội bộ nhận thư ở cổng 1025. `prisma:seed` tạo sản phẩm demo và tài khoản Barista khi `BARISTA_EMAIL`, `BARISTA_PASSWORD` có trong môi trường shell. Với backend chạy bằng npm, nạp biến từ `.env` trước seed, ví dụ `set -a; source .env; set +a; npm --prefix backend run prisma:seed` trong zsh. Lệnh seed idempotent, không đặt lại stock/giá sản phẩm đã có.

Nếu cài PostgreSQL riêng, tạo database `brewlite`, cập nhật `DATABASE_URL` và chạy các lệnh Prisma ở trên. Không chạy migration vào DB đang dùng bởi repo khác trước khi kiểm tra URL.

### Chạy cả ba dịch vụ với Compose

```bash
docker compose up --build
# terminal khác, sau khi DB và backend sẵn sàng
set -a; source .env; set +a; npm --prefix backend run prisma:seed
```

Lưu ý lệnh seed ở host dùng `DATABASE_URL` trỏ cổng host 5434. Frontend chạy cổng 3000, backend 3001, DB 5434. Dockerfile frontend build mặc định mode API để dùng Orders/Payment/VNPAY thật; khi đổi `NEXT_PUBLIC_*` cần build lại image.

## Chế độ dữ liệu

`NEXT_PUBLIC_DATA_MODE=api` là mặc định và là chế độ bắt buộc cho thanh toán VNPAY. Orders/Inventory/Payments gọi REST thật; lỗi API không tự fallback sang mock. `POST /payments` chỉ khởi tạo giao dịch PROCESSING và trả URL hosted; Order chỉ chuyển PAID/PAYMENT_FAILED sau IPN hợp lệ hoặc phản hồi QueryDR đã kiểm chữ ký. Màn `verifying` đọc Order mỗi 2 giây và gọi QueryDR theo lịch giới hạn ở lần 1/4/8/12/18/24/30 để phục hồi trường hợp IPN trễ hoặc VNPAY chưa đồng bộ; sau 30 lần kiểm tra (khoảng 60 giây) sẽ chuyển sang trạng thái chưa rõ thay vì treo vô hạn. Nút “Kiểm tra trạng thái đơn” vẫn cho phép đối soát lại thủ công.

`NEXT_PUBLIC_DATA_MODE=mock` và `hybrid` vẫn dành cho phát triển các module chưa hoàn thiện; dữ liệu mock nằm riêng trong `frontend/src/services/mock.ts` và không phải bằng chứng tích hợp VNPAY. Auth luôn gọi backend thật. Không dùng hai mode này khi nghiệm thu thanh toán.

Áp migration mới trước khi chạy backend VNPAY. Checkout không còn bộ chọn kết quả demo: người dùng được chuyển sang trang hosted của VNPAY rồi quay lại BrewLite trong lúc frontend chờ IPN xác nhận. Backend chỉ gửi `vnp_BankCode` khi `VNPAY_BANK_CODE` có giá trị; để trống cho merchant TEST chưa được cấp QR để tránh lỗi “Ngân hàng thanh toán không được hỗ trợ”. Nếu merchant đã được VNPAY bật QR, đặt `VNPAY_BANK_CODE=VNPAYQR` để ưu tiên luồng QR.

Ngày 2026-10-22, bộ phận kỹ thuật VNPAY xác nhận đã active VNPAYQR cho terminal TEST của dự án. Cấu hình local hiện dùng `VNPAY_BANK_CODE=VNPAYQR`; URL thanh toán sinh ra đã được kiểm tra có bank code này và chữ ký HMAC-SHA512. Đây là cấu hình riêng của terminal hiện tại, không đổi giá trị mặc định trống trong file mẫu.

QR do VNPAY Sandbox tạo có thể báo “QR không tồn tại” khi quét bằng ứng dụng ngân hàng LIVE vì hạ tầng TEST và LIVE tách biệt. Đây không tự động là lỗi chữ ký của BrewLite và không phải bằng chứng giao dịch thành công. Khi kiểm thử, dùng thẻ/NCB test hoặc ứng dụng QR TEST iOS/Android mà VNPAY đã cấp cho terminal, không dùng ứng dụng ngân hàng LIVE.

VNPAY đã cung cấp ứng dụng QR TEST (iOS TestFlight/Android) và công cụ VSM Sandbox qua email. Không ghi credential VSM vào repository hoặc log; cấu hình IPN HTTPS trong công cụ rồi dùng phương tiện TEST/NCB test theo hướng dẫn VNPAY, không dùng ứng dụng ngân hàng LIVE.

Return URL không cập nhật trạng thái. Return có mã không thành công chuyển người dùng tới `/payment/:id/unknown`; nút “Thử lại” từ màn này quay về `/checkout?resumeOrder=<id>` và replay đúng `idempotencyKey`/Payment `PROCESSING` hiện có, không tạo Order hoặc Payment mới. Chỉ khi IPN hoặc QueryDR đã xác minh `PAYMENT_FAILED`, luồng mới dùng `/checkout?retryOrder=<id>` với key mới để tạo Payment attempt mới trên cùng Order.


Để chạy E2E API mode: `docker compose stop frontend`, chạy `NEXT_PUBLIC_DATA_MODE=api NEXT_PUBLIC_API_URL=http://localhost:3001/api npm --prefix frontend run dev -- --port 3000` ở terminal riêng; sau đó chạy nhóm test API phù hợp. Sandbox VNPAY thật cần một backend HTTPS công khai để VNPAY gọi IPN.

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

Lượt VNPAY TEST 2026-10-22: Prisma generate/validate, backend build/lint và **18 suite/191 test PASS**; frontend **19/19 unit**, typecheck, production build và lint phạm vi VNPAY PASS; checkout không tràn ở 1440/768/390. Compose hiện chạy đủ PostgreSQL/backend/frontend và migration `20261021000000_vnpay_gateway` đã được áp dụng; 2 suite/11 test PostgreSQL chuyên biệt vẫn skip vì chưa cấu hình database test riêng. Thanh toán Sandbox bằng tài khoản test `NGUYEN VAN A` đã được QueryDR xác minh và lưu DB: Order `66e28a10-a95e-45ee-b877-a1617e9c3abf` cùng Payment đều `PAID`, `vnp_TransactionNo=15711511`, ngân hàng `NCB`, `vnp_PayDate=20261022114118`, idempotency key `3998d99e-ff66-4ee6-a204-0a22cc35b60c`. T08 vẫn IN_PROGRESS vì IPN trên portal chưa được cấu hình và chưa có bằng chứng E2E callback IPN thật.

Sau khi nhập `origin/main` ngày 2026-10-22: backend build/lint, **20 suite/253 test không-DB**, backend E2E **6 suite/126 test**, frontend **20/20 unit + lint + production build** đều PASS. Bộ Payment PostgreSQL tạo database tạm, áp đủ **13 migration** và PASS **7 suite/101 test**; database tạm đã được xóa. Lượt này cũng sửa lỗi tích điểm hai lần khi VNPAY chuyển Order sang `PAID`. `docker compose config --quiet` PASS và ba service đang chạy, PostgreSQL healthy.

Lượt nối Payment–Order 2026-10-17 phía dưới là bằng chứng lịch sử của mock gateway, không xác nhận VNPAY: Prisma generate, backend build/lint và 18 suite/165 test không-DB đã PASS; 2 suite/18 test PostgreSQL Payment cũ đã PASS trên DB tạm.

## Nhóm, branch và PR

Cập nhật TV4 2026-10-15: Prisma generate/validate, build/lint hai phía, 138 backend tests và 8 frontend tests qua. Bảy PostgreSQL tests chưa chạy: máy không có Docker CLI và DB `localhost:5434/brewlite` từ chối kết nối. Migration Orders được tạo offline, chưa apply; chưa VERIFIED_COMPLETE. Xem `docs/TESTING.md` để chạy lại trên DB kiểm thử riêng. Các số liệu Compose/E2E ở phần trên là bằng chứng của mốc nền tảng trước đó, không xác nhận Orders mới.

TV1 duy trì kiến trúc, UI, auth và docs; TV2 Products; TV3 options/cart; TV4 Orders/inventory/state machine; TV5 Payments/idempotency; TV6 Promotions/Loyalty/History/E2E. Chi tiết ở `docs/TEAM_HANDOFF.md`. Nhánh `feature/auth-and-base` chứa nền tảng dự án và phần auth; các thành viên tạo branch `feature/products`, `feature/orders`, `feature/payments`, `feature/loyalty`, `feature/barista` từ nhánh tích hợp do nhóm thống nhất. PR phải nêu thay đổi DTO, test và cập nhật docs.

## Đọc tiếp

Bắt đầu với `docs/PROJECT_STRUCTURE.md`, `docs/PROJECT_CONTEXT.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, rồi `docs/INTEGRATION_GUIDE.md`. Trạng thái hiện hành ở `docs/PROJECT_STATUS.md`. Hạn chế chính: QueryDR Sandbox đã xác minh và lưu một giao dịch test, nhưng IPN HTTPS trên portal chưa được cấu hình nên E2E callback IPN thật chưa được xác nhận; ảnh gốc Stitch cần mạng (có SVG dự phòng offline). Các bằng chứng mock cũ không xác nhận tích hợp VNPAY.


## Lịch sử riêng nhánh TV4 trước khi nhập main ngày 2026-10-26

Các bằng chứng dưới đây thuộc code và gateway mock ở thời điểm ghi nhận, không xác nhận phiên bản VNPAY hiện tại.

> TV4, cập nhật 2026-10-18: đối chiếu báo cáo hoàn chỉnh `(2).docx`; backend Orders/Inventory/State Machine/Barista sẵn sàng review. **272/272 backend tests, 25 suites, 0 skipped** và browser khách–Barista hai phiên API thật tại **1440/768/390 PASS**. Build/lint/typecheck backend PASS; frontend Webpack/API build PASS. UI API mode hủy/lịch sử/KPI còn cần TV1 nối endpoint đã có. [Ma trận yêu cầu, bằng chứng và cách chạy lại](docs/TV4_ACCEPTANCE.md). Mốc Task 06 bên dưới là lịch sử.

> Task 06 đã kiểm chứng lại trên nhánh `feature/task-06-orders`, code `2c8adc2` sau khi nhập main `bacb7a6`: 247/247 backend tests trên PostgreSQL thật (0 skipped), frontend unit 14/14 và browser Orders API 4/4 tại 1440/768/390. Cập nhật [PR #16](https://github.com/giakhoi0123/Brewlite_swe_project1/pull/16), chưa merge; giữ đủ 5 commit cũ. Xem [bằng chứng kiểm chứng lại](docs/TASK06_REVIEW_VERIFICATION.md). Task 06 dừng ở PENDING, không dùng browser này để chốt Payment. Lint frontend toàn repo còn lỗi profile có sẵn.
