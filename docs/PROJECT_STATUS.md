# Trạng thái dự án

## Tích hợp `origin/main` vào Payment — 2026-10-22

Đã fetch và nhập `origin/main:cff6ff0` vào `feature/payment-demo-persistence`, giữ nguyên Auth/Orders/Inventory/Promotions/Loyalty/Barista mới trên `main` và thay mock gateway bằng VNPAY. Migration VNPAY chủ động bỏ partial index consistency cũ trước khi tạo index active attempt mới, nên legacy `UNKNOWN` không chặn attempt VNPAY hợp lệ. `POST /payments` nhận idempotency key từ body hoặc header `Idempotency-Key`; hai nguồn không khớp trả 400.

Kiểm chứng sau merge: Prisma generate/validate, backend build/lint, **20 suite/253 test không-DB**, backend E2E **6 suite/126 test**, frontend **20/20 unit**, lint và production build đều PASS. Bộ `test:payments:postgres` tạo database riêng, áp đủ **13 migration**, PASS **7 suite/101 test** rồi xóa database tạm. Lượt PostgreSQL đầu phát hiện điểm Loyalty bị cộng hai lần do cả Orders và Payment adapter cùng increment; adapter đã được sửa để Orders là owner duy nhất của phép cộng, Payment chỉ ghi `LoyaltyLog` và xóa giỏ trong cùng transaction. Lượt chạy lại PASS. Compose config PASS; PostgreSQL/backend/frontend đang chạy và PostgreSQL healthy. Database ứng dụng local chưa được mutate trong lượt merge; `prisma migrate status` còn ba migration pending: `20261017000000_payment_consistency`, `20261019000000_loyalty_log`, `20261022000000_vnpay_consistency_compat`.

T08 vẫn **IN_PROGRESS**: các kiểm tra trên xác nhận migration, persistence, state machine và QueryDR/IPN logic trong test, nhưng portal chưa có bằng chứng callback IPN HTTPS E2E thật.

## VNPAY-QR trước merge — 2026-10-21

Đã chuyển thiết kế Payment từ mock đồng bộ sang VNPAY WebPay 2.1.0 bất đồng bộ. Checkout chỉ còn phương thức thanh toán VNPAY; backend tạo URL HMAC-SHA512 với amount lấy từ Order. `VNPAY_BANK_CODE` là biến backend tùy chọn, mặc định để trống để trang hosted hiển thị các phương thức terminal được cấp; chỉ đặt `VNPAYQR` khi VNPAY đã bật kênh QR cho merchant TEST. Return URL chỉ xác minh/điều hướng. IPN là nguồn chính; QueryDR có chữ ký là fallback khi IPN trễ/mất. Cả hai đường xác nhận đều kiểm tra merchant, transaction reference và amount trước khi cập nhật Payment + Order/history/inventory/loyalty trong transaction. Các cờ chọn kết quả demo được gỡ khỏi UI/cấu hình API.

Phương thức thanh toán trên trang hosted phụ thuộc quyền được cấp cho terminal VNPAY; repo không tự mã hóa payment URL thành QR giả. Ngày 2026-10-22, request ép `VNPAYQR` ban đầu bị VNPAY trả “Ngân hàng thanh toán không được hỗ trợ”; bộ phận kỹ thuật VNPAY sau đó xác nhận đã active VNPAYQR cho terminal TEST. Cấu hình local hiện dùng `VNPAY_BANK_CODE=VNPAYQR`, backend đã được recreate và URL ký thử chứa đúng bank code. File mẫu vẫn để trống vì quyền QR phụ thuộc terminal.

Sau khi Sandbox hiển thị QR, quét bằng ứng dụng ngân hàng LIVE có thể báo “QR không tồn tại” vì hệ thống TEST và LIVE tách biệt. VNPAY đã cấp liên kết ứng dụng QR TEST iOS/Android và công cụ VSM Sandbox qua email; bước tiếp theo là cấu hình IPN HTTPS trong VSM và chạy một giao dịch QR TEST mới. Hiện chưa có bằng chứng QR/IPN end-to-end thành công.

Return có mã không thành công hiện chỉ điều hướng tới `/payment/:id/unknown`, không mutate Payment/Order. “Thử lại” từ UNKNOWN dùng `/checkout?resumeOrder=id`, giữ nguyên payment intent, idempotency key và Payment `PROCESSING`, nên không tạo Order/Payment mới. Nhánh `PAYMENT_FAILED` đã được IPN hoặc QueryDR chốt vẫn dùng `/checkout?retryOrder=id` với key mới để tạo attempt mới trên cùng Order. Endpoint owner-auth `POST /payments/:orderId/reconcile` được frontend gọi một lần khi vào `verifying` và khi người dùng bấm “Kiểm tra trạng thái đơn”.

Kiểm chứng ngày 2026-10-22: Prisma generate/validate, backend build/lint và **18 suite / 191 test PASS**; 2 suite/11 test PostgreSQL bị skip vì chưa cấu hình database test tách biệt. Frontend **19/19 unit**, typecheck, production build và lint phạm vi VNPAY PASS. Browser QA checkout tại **1440/768/390** không tràn ngang, chỉ có một lựa chọn VNPAY và không còn selector kết quả demo/Ví/Thẻ. Compose đang chạy đủ PostgreSQL/backend/frontend; PostgreSQL healthy, backend HTTP 200 và migration VNPAY đã áp dụng. Full frontend lint còn đúng một lỗi có sẵn ngoài phạm vi tại `profile/page.tsx:21`.

Giao dịch Sandbox bằng tài khoản TEST `NGUYEN VAN A` đã thành công và được QueryDR lưu xuống PostgreSQL: Order `66e28a10-a95e-45ee-b877-a1617e9c3abf` cùng Payment đều `PAID`; `vnp_TransactionNo=15711511`, bank `NCB`, pay date `20261022114118`, idempotency key `3998d99e-ff66-4ee6-a204-0a22cc35b60c`. T08 vẫn **IN_PROGRESS** vì IPN trong portal chưa được cấu hình và chưa có bằng chứng callback IPN E2E thật. Các bằng chứng mock/PostgreSQL ngày 2026-10-17 phía dưới chỉ là lịch sử baseline.

## Tích hợp Payment–Order — 2026-10-17

Payment đã có foreign key tới Order, finalize Payment/Order trong cùng transaction, replay idempotent và retry cùng order. Retry chỉ giữ lại tồn kho khi gateway trả PAID; PAYMENT_FAILED/UNKNOWN lặp lại không đổi Order hoặc tồn kho. Backend Prisma generate/build/lint và 18 suite/165 test không-DB qua; 2 suite/18 test PostgreSQL Payment qua; frontend 14/14 unit, production build và browser API FAILED→checkout→PAID cùng order qua. Dockerfile/Compose đã truyền cờ `NEXT_PUBLIC_PAYMENT_DEMO_CONTROLS` vào lúc build; bản Docker API mode đã build, áp đủ 9 migration và chạy lại E2E FAILED→retry→PAID thành công. Gateway production và browser UNKNOWN/Wallet mở rộng vẫn còn chờ nên T08 giữ IN_PROGRESS.

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
| Payment | UI_COMPLETED | IN_PROGRESS | VNPAY TEST + QueryDR đã lưu PAID thật trong DB; 18 suite/191 backend, 19/19 frontend; checkout QA 1440/768/390 | TV1/TV5 | IPN là nguồn chính nhưng portal/callback IPN E2E chưa cấu hình/xác nhận |
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
