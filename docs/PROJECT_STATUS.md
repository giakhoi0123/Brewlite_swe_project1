# Trạng thái dự án

## QA nghiệm thu 9 US — 2026-10-19, sau pull/merge `b87db13`

Biên bản hiện hành: [`TEST_REPORT_BREWLITE.md`](../TEST_REPORT_BREWLITE.md). Đã sửa năm tiêu chí sai khác của US-04/05/07/09 và bổ sung API Barista hủy có lý do. Trên PostgreSQL 15.19 QA riêng với 11 migrations: backend Jest 25 suites/301 tests PASS; E2E 6 suites/185 tests PASS; frontend unit 15/15 PASS; backend build/typecheck/lint và frontend scoped lint/build PASS. Coverage backend statements 91,69%, branches 77,47%, lines 92,06%. 9/9 US đạt nghiệm thu kỹ thuật theo phạm vi test; database QA đã xóa. Database Compose cục bộ đã áp dụng đủ 11 migrations trong lượt cập nhật giao diện; gateway thật/hoàn tiền thật chưa nằm trong phạm vi kiểm chứng. Các trạng thái lịch sử bên dưới là kết quả của mốc cũ.

## Task 06 review — 2026-10-17, mốc lịch sử

Nhánh hiện tại `feature/task-06-orders`; PR #16 đang mở, chưa merge. PR #13 đóng chưa merge; đủ 5 commit gốc đến `03ff19b` còn nguyên và chưa có trong main tại lúc audit. Đã nhập main `bacb7a6` qua `2c8adc2`; chỉ xung đột tài liệu, không ghi đè AppModule/Payment/Promotion/Staff/schema của main.

Kiểm chứng code `2c8adc2`: **247/247 backend tests trên PostgreSQL 15.18 thật, 24 suites, 0 skipped**, đủ 10 migration; frontend unit **14/14**, browser Orders API **4/4 tại 1440/768/390**. Backend build/lint/full test typecheck, frontend API build Webpack và scoped lint frontend PASS. Frontend lint toàn repo **FAIL** ở `profile/page.tsx:21` (memoization) có sẵn từ main; không sửa UI ngoài Task 06. Prisma generate PASS sau khi chờ lượt DB test kết thúc để giải phóng DLL Windows.

T06 READY_FOR_REVIEW. Browser chặn request Payment bằng route.abort, xác minh Order PENDING, giỏ còn, Payment=0; không dùng để chốt Payment. Log/ảnh/ma trận commit và lệnh chạy: [TASK06_REVIEW_VERIFICATION.md](TASK06_REVIEW_VERIFICATION.md). PostgreSQL/servers/DB test riêng, không reset DB nhóm. Compose/default Turbopack chưa chạy ở lượt này. Các mốc dưới là lịch sử.

## Task 06 trên main mới — 2026-10-16

Đã fetch/pull từ `a80e712` lên `origin/main:c2d6922` trước khi tạo nhánh `codex/task-06-orders`. **T06 READY_FOR_REVIEW**: API tạo PENDING, validation/UUID, giá server, transaction/snapshot, Auth và ownership đã kiểm chứng. Backend **201/201 trên PostgreSQL 15 thật, 0 skipped**; browser API **4/4 tại 1440/768/390**; frontend unit 13/13, backend build/lint/typecheck và frontend Webpack build PASS. Còn review PR của nhóm theo DoD.

Bằng chứng, commit từng phần và cách chạy: [TASK06_VERIFICATION.md](TASK06_VERIFICATION.md). Lint frontend toàn repo đang có lỗi memoization ở profile từ main mới; lint các file Task 06 thay đổi PASS. Docker Compose chưa chạy ở máy này; kết quả không xác nhận Task 08/09/10 hoàn thành. Main mới đã có PaymentsModule/PromotionDiscount, nên những đoạn “chưa bật/chưa có” phía dưới là lịch sử, không phải trạng thái mã mới.

## Payment consistency — 2026-10-17, mới nhất

Đã tích hợp main `808077f` vừa nhận PR #15/#17, giữ nguyên sandbox/UI/FK của nhóm; bộ kiểm chứng cuối gồm cả Payment/Orders/FK và gateway sandbox từ main. Browser/Compose của PR #17 là bằng chứng lịch sử của nhánh đó, không coi là đã kiểm chứng lại consistency trong browser.

Giữ nhánh `feature/fix-payment-status` (nền `faea93e` có bản sửa `b6ca9ac`), PR #18 đang mở, chưa merge; PR #15 status đã được merge. Hoàn thiện claim khóa theo Order, replay không gọi gateway/cộng điểm lại, chặn key mới khi PROCESSING/UNKNOWN/PAID, retry giữ kho lại trước gateway, journal bền vững và transaction chung Payment–Order–kho–history–điểm. Không giữ DB transaction khi gọi gateway, không sửa UI/đổi điểm.

**READY_FOR_REVIEW trong phạm vi consistency**: 9 suites/111 tests PASS, 0 skipped, gồm 40 ca PostgreSQL thật (20 consistency chạy qua hai AppModule độc lập, 2 migration legacy, 15 status, 3 integration/FK). Áp đủ 10 migration trên DB UUID riêng rồi xóa đúng DB đó. Backend build/lint, Payment typecheck và script syntax PASS. Full test typecheck vẫn 5 lỗi baseline Products/NoPromotionDiscount; không mở rộng sang sửa chúng.

**T08/10B chưa VERIFIED_COMPLETE toàn bộ**: chưa browser E2E/Compose, chưa gateway ngân hàng hay quy trình đối soát tự động. PROCESSING không có journal và UNKNOWN phải giữ khóa để đối soát, không tự retry charge. Trước deploy cần audit dữ liệu Payment cũ/multiple live attempts; migration không tự xóa hoặc sửa bản ghi tài chính. Chi tiết/log: [PAYMENT_CONSISTENCY_VERIFICATION.md](PAYMENT_CONSISTENCY_VERIFICATION.md). Các mốc dưới là lịch sử.

## Bản sửa Payment status — 2026-10-17

Nhánh `feature/fix-payment-status` từ `origin/main:c2d6922`. Đã thống nhất PAID/PAYMENT_FAILED/UNKNOWN giữa gateway, PaymentsService, repository, PaymentOrderPort và adapter AppModule; loại ánh xạ SUCCESS/FAILED sai, kiểm tra ownership trong transaction và chỉ cộng điểm theo chính sách có sẵn khi chuyển PAID thành công. Không sửa UI/đổi điểm, không thêm migration.

Trước sửa: suite mới tái hiện 5 lỗi (2 kết quả PAID bị chuyển PAYMENT_FAILED và 3 trường hợp adapter không kiểm tra ownership). Sau sửa: **5 suites / 80 tests PASS, 0 skipped**, gồm **15 ca AppModule/HTTP trên PostgreSQL 15.18 thật**, áp đủ 8 migration trong DB tạm riêng. Backend build/lint và typecheck phạm vi Payment cùng các import PASS. Typecheck toàn bộ tests vẫn lỗi 5 mục có sẵn ở main: 2 import NoPromotionDiscount và 3 fixture Products. Chi tiết tại [PAYMENT_STATUS_VERIFICATION.md](PAYMENT_STATUS_VERIFICATION.md).

**T08 vẫn IN_PROGRESS**: retry/replay, transaction giữa Payment và Order, concurrency và browser E2E toàn luồng còn cần TV5 xử lý. PostgreSQL chạy tạm riêng, không thay DB ứng dụng; Docker Compose chưa kiểm chứng trong lượt này. Các bảng phía dưới là lịch sử trước bản sửa.

## Ảnh chụp trạng thái sau khi nhập origin/main — 2026-10-16

| Phần | UI có mã | Đã so Stitch | Chức năng FE đã test | Backend thật | Test backend/API | Phần còn chờ |
|---|---|---|---|---|---|---|
| Menu/chi tiết/giỏ/checkout/payment/order | Có | 9 export đã xem; các trang chính đã chụp QA 1440/768/390 | Demo E2E 4/4 trước merge; unit 14/14 hiện tại | Products/Cart/Orders/Payment có backend; gateway Payment là mock | Backend 18 suites/165 tests; Payment PostgreSQL 2 suite/18 test và HTTP smoke DB qua | Payment/browser API E2E mở rộng, Promo |
| Hồ sơ/điểm | Có; thẻ thành viên, lịch sử đơn, trạng thái voucher | Hồ sơ đối chiếu Stitch; 3 viewport không tràn | E2E điểm sau PAID; browser QA | Auth thật; Loyalty mock | Auth DB HTTP PASS; Loyalty API chưa có | TV6 |
| Auth | Có | Login/register đối chiếu Stitch | Đăng ký, đăng nhập, refresh, role, logout trong E2E trước merge | NestJS/PostgreSQL thật, JWT version | 168/168 backend tests sau merge; HTTP smoke Auth DB QA PASS trước merge | Deploy migration trên DB dùng chung |
| Barista | 5 route, KDS, KPI, chi tiết, xác nhận, hủy, lịch sử | Barista Stitch và QA 3 viewport | Unit + E2E mock workflow/hủy PASS | TV4 đã có list/transition; detail/hủy lý do/lịch sử chưa có | API integration một phần; cần test sau merge | TV4 hoàn thiện hợp đồng Staff |

`UI_COMPLETED` của Barista và các module khách hàng không đồng nghĩa backend nghiệp vụ đã xong. Sau merge đã chạy Docker build, 8 migrations và 168 backend tests trên DB tạm, frontend build/lint/unit 13/13. Bản QA frontend cổng 3006/backend cổng 3005 phục vụ lượt TV1 trước merge, chưa phải bản Orders API tích hợp.

TV4 đã sửa lỗi create order dùng `history` thay vì `statusHistory` bằng `satisfies Prisma.OrderUncheckedCreateInput`. Trên nhánh TV4, **146/146 backend tests qua, gồm 8 PostgreSQL tests**; HTTP cookie JWT + Origin thật tạo đơn PENDING và giữ kho; concurrency/rollback qua. Đây là bằng chứng trước khi nhập Auth mới, không tự suy ra merge đã qua test.

TV4 cũng đã loại UTF-8 BOM ở đầu `backend/prisma/schema.prisma` để Prisma build trên Linux. Các blocker Docker/DB cũ phía dưới là lịch sử.

`UI_COMPLETED` nghĩa là màn hình/adapter có code và build, chưa nghĩa là backend thật đã hoàn tất. Cập nhật cùng `IMPLEMENTATION_PLAN.md` sau mỗi mốc.

Ngày 2026-10-15: khắc phục lỗi `Failed to fetch` khi đăng ký từ frontend cổng 3002. Backend cho phép danh sách origin cấu hình trong `.env` ở cả CORS và bảo vệ cookie; origin ngoài danh sách vẫn bị từ chối. Cần build lại backend Compose để áp dụng mã mới.

Ảnh tham chiếu Stitch được nén thành `screen.webp`; icon ứng dụng được thu nhỏ còn 256 px. Các file này chỉ phục vụ đối chiếu thiết kế và nhận diện ứng dụng, không thay đổi chức năng.

Cây thư mục và bản đồ chức năng để bàn giao/đánh giá được duy trì trong `docs/PROJECT_STRUCTURE.md` và liên kết từ README.

Đã đối chiếu lại `screen.webp` của trang chủ, auth, chi tiết món và giỏ hàng: hero ảnh xếp lớp, danh sách món, bố cục auth hai cột, nhóm tùy chọn và tóm tắt giỏ đã được chỉnh gần thiết kế Stitch hơn. Kiểm tra desktop 1440 px và mobile 390 px không thấy tràn ngang; build/lint và 3 frontend unit tests qua. Backend auth vẫn cần chạy để thử đăng nhập thực tế.

Payment frontend đã bổ sung payment intent có kiểm tra dữ liệu, xử lý lỗi khi xác minh và chỉ xóa intent/giỏ sau PAID. Từ màn thất bại, “Thử thanh toán lại” quay về checkout của cùng order, dùng snapshot/tổng tiền cũ, cho chọn lại phương thức/kịch bản và không tạo order trùng. Order API trả `paymentMethod` từ Payment PAID mới nhất để màn thành công luôn hiện đúng Ví/Thẻ kể cả sau reload. Backend đã đăng ký PaymentsModule và nối `PAYMENT_ORDER_PORT`; finalize Payment và Order transition dùng cùng transaction, replay không ghi/cộng điểm lần hai, retry failed giữ lại tồn kho. Migration mới thêm foreign key Payment→Order.

| Feature | Frontend | Backend | Tests | Owner | Ghi chú |
|---|---|---|---|---|---|
| Menu, chi tiết | VERIFIED_COMPLETE (chi tiết làm lại theo Stitch 2026-10-15) | Products API VERIFIED_COMPLETE | Playwright (Edge) mock 3/3 + API mode 2/2 qua | TV1/TV2/TV3 | Mock và API adapter |
| Giỏ | VERIFIED_COMPLETE (làm lại theo Stitch 2026-10-15) | Cart API VERIFIED_COMPLETE (`/cart`, PostgreSQL) | 11 backend tests; smoke HTTP DB thật 12/12; luồng trình duyệt API mode 8/8; unit mock cart | TV1/TV3 | Khách: Zustand persist; đăng nhập: giỏ lưu server |
| Auth | UI_COMPLETED | Code đầy đủ | 37 backend tests; PostgreSQL HTTP; Playwright đăng ký/role qua | TV1 | Cookie JWT và role |
| Checkout / Orders | UI_COMPLETED | IN_PROGRESS (code TV4 đã có) | Unit/HTTP giá, DTO, guard, stock/state qua; PostgreSQL/E2E thật chưa chạy | TV1/TV4 | Có POST PENDING, GET mine/detail/status; bật api mode để dùng backend |
| Payment | UI_COMPLETED | IN_PROGRESS | PostgreSQL 2 suite/18 test; API sandbox PAID/FAILED/UNKNOWN; browser FAILED→checkout→retry PAID cùng order; checkout retry QA 1440/768/390 | TV1/TV5 | Đã nối Orders/FK; còn browser UNKNOWN/Wallet mở rộng và gateway production |
| Lịch sử/tracking | UI_COMPLETED | IN_PROGRESS | GET orders/me/detail/status có backend TV4; DB/E2E chưa xác minh | TV1/TV4/TV6 | Snapshot item giữ nguyên giá/tên cũ; TV6 tiếp tục history integration |
| Promotion/Loyalty | UI_COMPLETED | BACKEND_PENDING | Playwright mã sai/đúng, điểm sau PAID qua | TV1/TV6 | BREW10 chỉ demo |
| Barista | UI_COMPLETED | IN_PROGRESS | HTTP role/DTO tests qua; state machine đủ 49 cặp | TV1/TV4 | Có GET/PATCH staff orders; chưa xác minh DB/browser |
| Docker | VERIFIED_COMPLETE | PostgreSQL chạy | Compose build, 3 container và HTTP qua | TV1 | Cổng DB 5434 |

## TV4 — 2026-10-15, feature/orders-and-inventory

Đã triển khai T06/10A/10C: migration `20261015000100_orders_inventory`, giá backend, snapshot món/topping, history, transaction tạo đơn + giữ kho, CAS stock Product.version và CAS Order.version, release một lần khi failed/cancel, reserve lại khi retry. CUSTOMER chỉ xem đơn của mình; BARISTA không được tự xác nhận thanh toán. Tích hợp TV5 qua `OrdersService.transitionInTransaction`; TV6 qua provider `ORDER_DISCOUNT`. Không thêm backend Payment/Promotion/Loyalty giả.

Prisma generate/validate và backend build/lint qua. Backend có 138 test qua, 7 test PostgreSQL **skipped** vì chưa có `ORDERS_TEST_DATABASE_URL`. Test thật trên PostgreSQL được viết cho tranh chấp 8 request/1 sản phẩm, rollback đa món, lỗi ghi đơn, hủy đồng thời, retry hết kho, rollback payment và snapshot lịch sử. Migration mới chỉ được tạo offline, chưa apply. Chưa đánh dấu VERIFIED_COMPLETE cho phạm vi TV4.

Checkout giữ phong cách UI cũ, dùng service API hiện có kèm cookie; xử lý lỗi/loading, chống submit đồng thời, điều hướng theo ID server và tránh POST lần nữa khi sessionStorage lỗi sau tạo đơn. GET status dùng JSON `{status}` và adapter unwrap. Bật `NEXT_PUBLIC_DATA_MODE=api` + restart/build frontend để dùng backend; mode mock vẫn dành cho demo. Thanh toán thật sau PENDING còn phụ thuộc TV5.

Blocker: không có Docker CLI, DB cấu hình `localhost:5434/brewlite` từ chối kết nối; cần chạy migration và PostgreSQL/browser E2E sau khi DB sẵn sàng. Typecheck mở rộng toàn bộ backend tests còn lỗi fixture Products có sẵn (thiếu stock/description), ngoài phần TV4; build ứng dụng và Jest vẫn qua. Kết quả frontend cuối cùng và lệnh tái lập xem `docs/TESTING.md`.

## TV3+TV5 — Cart/Payment (merged vào main)

Ngày 2026-10-15 (nhánh `feature/cart_productDetail`):
- UI chi tiết và giỏ dựng lại theo Stitch (`product_details/`, `cart/`): thẻ size, topping, mức đá/đường, ghi chú cho Barista (`CartItem.note`), "Mua ngay", gợi ý món "Thêm nhanh"; giỏ đổi size tại chỗ, voucher lưu trong store và checkout áp dụng sẵn.
- Backend giỏ theo tài khoản: bảng `carts`/`cart_items` (migration `20261015000000_add_cart`), module `backend/src/cart`. Giá không lưu mà luôn tính lại từ Product khi đọc; dòng trùng cấu hình được gộp; chặn vượt tồn kho (409); size/topping không hợp lệ 422; giỏ riêng từng user. `cart-pricing.ts` là hàm tính giá dùng chung, TV4 có thể tái sử dụng cho `POST /orders`.
- Frontend: `CartService` (mock + REST), `components/cart-sync.tsx` gộp giỏ khách lên server khi đăng nhập, xóa bản sao khi đăng xuất. Khách vãng lai vẫn dùng Zustand như cũ.
- Thêm `NEXT_PUBLIC_DATA_MODE=hybrid`: sản phẩm + giỏ hàng gọi backend thật, đơn/thanh toán/ưu đãi/điểm/Barista vẫn mock (`demoOrders` điều khiển phần UI demo). Kiểm tra trên trình duyệt Edge + PostgreSQL: thêm, thêm món thứ 2, tăng số lượng, đổi size, xóa món, thanh toán demo PAID (giỏ server được xóa), xóa tất cả — 8/8, mỗi bước đối chiếu trực tiếp bảng `cart_items`.
- Sửa selector E2E mơ hồ `getByText('Tạm hết')` (trang chủ hiện có 2 chữ "Tạm hết" từ commit `0e669c8`).
# Cập nhật giao diện nghiệm thu 19/10/2026

- Login và register có nút hiện/ẩn mật khẩu độc lập; mặc định nhập ở trạng thái che.
- Bỏ banner chế độ dữ liệu và ghi chú demo khỏi giao diện khách hàng/Barista. Bản sandbox có nút “Kiểm thử thanh toán” dưới phương thức thanh toán; bấm để mở bộ chọn PAID/FAILED/UNKNOWN (hoặc vào `/checkout?qa=1`). Bản production tắt cờ nên không hiện nút. Đã thêm hướng dẫn thao tác thanh toán và sửa header mobile khi tên thành viên dài.
- Frontend mặc định `NEXT_PUBLIC_DATA_MODE=api` trong source, `.env.example`, Dockerfile và Compose; `.env` cục bộ đã chuyển sang `api`. Compose đã được build lại và PostgreSQL cục bộ có đủ 11 migrations. Cổng thanh toán vẫn là sandbox. Thêm `/promotions/validate` dùng chung chính sách giá của Order; điểm thành viên đọc từ `/auth/me`.
- Barista API mode hiển thị lịch sử COMPLETED/CANCELLED, nút hủy có lý do và KPI đã giao hôm nay từ `completedAt` trong response Order.
- Thẻ thành viên trên trang chủ nay phụ thuộc trạng thái Auth: khách chưa đăng nhập được dẫn tới `/register`; CUSTOMER đã đăng nhập được dẫn tới `/profile`; BARISTA không thấy lời mời tích điểm. Tài khoản CUSTOMER tự động tham gia Loyalty, không có bước ghi danh riêng. Điểm = `floor(Order.total / 10.000)` chỉ khi PAID.
