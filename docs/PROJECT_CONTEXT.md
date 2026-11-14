# Ngữ cảnh dự án cho phiên làm việc tiếp theo

## Mở lại VNPAY và xác minh phương thức NCB TEST — 2026-11-11

Checkout hiện mở `VNPAY_QR` làm lựa chọn mặc định và giữ `ADMIN_APPROVAL` song song; retry sau khi reconcile xác nhận `PAYMENT_FAILED` cũng mở lại hai phương thức. Với `VNPAY_BANK_CODE=` trên local, một Order TEST 43.000đ có attempt đầu mã hủy `24` lưu `PAYMENT_FAILED`, sau đó attempt mới qua NCB được lưu `PAID` với `vnp_TransactionNo=15733709`, response/status `00`; Order `ac15afd4-9cf8-461d-81a4-fe359cb21e43` đã thành `PAID`. Frontend 32/32 unit, TypeScript, build, lint 0 lỗi/2 warning cũ và Playwright 6/6 PASS. Schema không lưu nguồn finalize nên chưa thể kết luận callback IPN đã chạy; T08 vẫn `IN_PROGRESS`.

## Không ép kênh VNPAYQR trên local — 2026-11-11

`.env` local hiện để `VNPAY_BANK_CODE=` để URL thanh toán mới không chứa `vnp_BankCode`; VNPAY hosted sẽ hiển thị các phương thức TEST mà terminal được cấp thay vì đi thẳng vào QR. Backend Compose đã recreate, HTTP 200 và gateway test 10/10 PASS. Phải tạo giao dịch mới; không chỉnh URL cũ vì sẽ làm sai chữ ký. IPN HTTPS E2E vẫn là blocker độc lập của T08.

## Lịch sử: VNPAY đang bảo trì tại checkout — 2026-11-10

Tại mốc này, checkout hiển thị badge “Đang bảo trì”, khóa `VNPAY_QR` và chọn `ADMIN_APPROVAL` mặc định. UI không tạo hoặc tiếp tục VNPAY; attempt lịch sử chỉ có thể gọi reconcile để xác minh trạng thái rồi chuyển sang Admin khi đã `PAYMENT_FAILED`. Backend/schema/dữ liệu VNPAY vẫn được giữ. Frontend 32/32, TypeScript/build, lint 0 lỗi/2 warning cũ và Playwright Docker 6/6 tại 1440/768/390 PASS; Compose đã rebuild. Trạng thái này đã được thay thế bởi lần mở lại ngày 2026-11-11 ở đầu tài liệu.

## Khách yêu cầu hủy thanh toán qua Admin — 2026-11-10

Khách đang chờ `ADMIN_APPROVAL` có thể nhập lý do và gửi yêu cầu hủy; thao tác này chỉ ghi `cancelRequestStatus=PENDING`, chưa hủy Order. Hủy Order trực tiếp bị chặn khi Payment Admin còn `PROCESSING`. Trang `/admin/payments` hiển thị lý do và buộc Admin xử lý hủy trước khi chốt thanh toán: chấp nhận chuyển Order `CANCELLED` trong cùng transaction và hoàn tài nguyên; từ chối bắt buộc phản hồi, giữ Order `PENDING`/Payment `PROCESSING`. Audit dùng các trường cancellation riêng qua migration `20261110000000_admin_payment_cancel_requests`. Backend non-DB 339/339, PostgreSQL Payment 113/113 với 19 migration, frontend 32/32 và Playwright Docker 6/6 tại 1440/768/390 PASS; migration đã áp DB ứng dụng và Compose đã rebuild.

## Đổi phương thức sau khi hủy VNPAY — 2026-11-10

Đã sửa luồng người dùng hủy trên trang VNPAY nhưng quay lại không chọn được phương thức khác. Return hợp lệ luôn vào `verifying`; màn `unknown` và chính checkout `resumeOrder` đều có nút “Kiểm tra để đổi phương thức” gọi QueryDR/reconcile trước. Chỉ khi backend xác minh Order `PAYMENT_FAILED` mới chuyển tới `retryOrder` và tạo key mới trên cùng Order. Theo trạng thái ngày 2026-11-11, retry mở VNPAY mặc định và Admin; attempt còn `PROCESSING` vẫn khóa theo intent cũ để tránh thanh toán song song. IPN HTTPS thật vẫn chưa được quan sát nên T08 chưa hoàn tất.

## Lịch sử: mở lại VNPAY tại checkout — 2026-11-10

Frontend đã gỡ trạng thái “Đang bảo trì”, mở radio `VNPAY_QR` và chọn VNPAY mặc định. `ADMIN_APPROVAL` vẫn chạy song song trong API mode. Resume giữ nguyên phương thức/idempotency key của attempt đang xử lý; backend/schema/contract VNPAY không đổi. Frontend 31/31 unit, TypeScript, production build, lint 0 lỗi/2 warning cũ và Playwright Docker 3/3 PASS; checkout đã kiểm tra 1440/768/390. Bộ Payment PostgreSQL tạm áp đủ 18 migration và PASS 7 suite/108 test rồi tự xóa database. Compose đã rebuild; PostgreSQL healthy, frontend/backend HTTP 200. Việc mở lại UI không tự hoàn tất T08: IPN HTTPS E2E trên portal/VSM vẫn là blocker độc lập.

## Thanh toán chờ Admin quyết định — 2026-11-09

Giữ nguyên VNPAY và thêm method `ADMIN_APPROVAL`. Khách chọn phương thức này chỉ tạo Payment `PROCESSING`, sau đó chờ tại `/payment/:orderId/pending-admin`; không có chuyển khoản, gateway hoặc outcome từ client. Role `ADMIN` đăng nhập vào `/admin/payments`, chọn Thành công hoặc Thất bại (thất bại bắt buộc ghi lý do). Backend conditional-update Payment và gọi `PAYMENT_ORDER_PORT` trong cùng transaction để Order thành `PAID` hoặc `PAYMENT_FAILED`; audit lưu reviewer/time/note. Migration `20261109000000_admin_approval_payments`; credential demo công khai của nhóm là `admin@gmail.com` / `Aa@12345`, provision qua seed và tuyệt đối không tái sử dụng ở production. Trang Admin dùng polling tuần tự và request sequence “latest wins”, ngăn response lỗi cũ ghi đè response mới thành công. Đã qua 334 test backend không-DB, PostgreSQL 108/108 với 18 migration, frontend 31/31, build/lint và Playwright 3/3 tại 1440/768/390. VNPAY IPN E2E vẫn chưa hoàn tất và T08 chưa VERIFIED_COMPLETE.

Admin và khách đã được tách phiên: khách/Barista dùng `brewlite_session`, Admin dùng `brewlite_admin_session`, có strategy/guard và endpoint `/auth/admin/me`, `/auth/admin/logout` riêng. Cùng một browser context có thể giữ đồng thời cả hai cookie; frontend chọn endpoint theo route. Logout Admin chỉ xóa cookie Admin cục bộ để không làm các thành viên khác dùng tài khoản chung bị out. Browser E2E thật cùng context đã PASS 2/2; backend Auth E2E 10/10, PostgreSQL Payment 108/108 và Playwright fixture Admin 3/3 PASS.

Tại mốc 2026-11-09, VNPAY Sandbox được hiển thị “Đang bảo trì” và bị khóa tại checkout; `ADMIN_APPROVAL` là lựa chọn mặc định. VNPAY từng được mở rồi khóa lại trong ngày 2026-11-10 trước khi được mở lại ngày 2026-11-11 theo trạng thái ở đầu tài liệu. Backend/schema VNPAY luôn được giữ để bảo toàn dữ liệu cũ. Kiểm tra DB ứng dụng ngày 2026-11-09 xác nhận 3 Payment `ADMIN_APPROVAL` đã lưu `PAID`, Order tương ứng `PAID`, có item, 2 dòng status history, reviewer/time và LoyaltyLog.

## Xác minh VNPAY bị treo — 2026-10-29

Frontend `verifying` đã đổi từ một lần QueryDR + chỉ poll Order sang poll Order mỗi 2 giây và QueryDR có giới hạn tại lần 1/4/8/12/18/24/30; tổng 30 lần (khoảng 60 giây) rồi chuyển `unknown`, không tạo Payment/Order mới. Cleanup effect cũng reset cờ khởi chạy để React Strict Mode không hủy lượt xác minh duy nhất. Unit frontend 30/30, lint 0 lỗi/2 warning có sẵn và production build 16 route PASS; image frontend Docker đã build/recreate. Backend bắt buộc `VNPAY_QUERY_IP_ADDRESS` là IPv4 công khai và từ chối loopback/private trước khi gọi VNPAY; gateway test 10/10, lint/build và Docker backend build/recreate PASS.

Runtime local xác nhận Return URL `localhost` vẫn hoạt động khi trình duyệt và Docker chạy cùng máy; màn `verifying` sau đó có thể dùng QueryDR outbound để chốt giao dịch mà không cần tunnel. Database hiện có các giao dịch gần nhất đã chuyển `PAID`, nhưng schema không lưu nguồn finalize nên đây không phải bằng chứng callback IPN thật. IPN portal/VSM vẫn cần cấu hình và quan sát E2E; không đánh dấu T08 hoàn tất.

## Yêu cầu Assignment 1 phục vụ báo cáo — 2026-10-27

Đã đọc đề gốc `BrewLite-CongNghePhanMem (3).pdf` và báo cáo nhóm `BrewLite_Assignment1 (1).pdf`; lưu nguồn, tiêu chí 10 task, Scrum/DoD, NFR, US01–US16 và điểm cần đối chiếu tại [ASSIGNMENT1_REQUIREMENTS.md](ASSIGNMENT1_REQUIREMENTS.md). Đọc ghi chú này khi làm báo cáo Assignment 1. Đề yêu cầu Ví/Thẻ mock; VNPAY Sandbox không tự thay thế Task 8. Barista là mở rộng nhưng state machine Task 10 vẫn bắt buộc. Nhận định trong PDF báo cáo gắn với main `2c45463`, không tự áp thành hiện trạng nhánh hiện có. Lượt này chỉ ghi nhớ tài liệu theo yêu cầu người dùng.

## Đồng bộ 2026-10-26

Nhánh hiện hành feature/orders-and-inventory đã nhập origin/main:2c45463 với VNPAY, Loyalty/Promotion và giỏ Zustand. Giữ API chi tiết và completedAt của TV4; hủy PREPARING theo main mới. Trạng thái kiểm chứng và giới hạn migration ở PROJECT_STATUS.md; các mô tả gateway mock phía dưới là lịch sử.

## Cập nhật VNPAY — 2026-10-21

Làm việc trên nhánh hiện có `feature/payment-demo-persistence`. Payment đang được chuyển từ mock đồng bộ sang VNPAY WebPay 2.1.0: checkout chỉ chọn `VNPAY_QR`, `POST /payments` tạo Payment PROCESSING và URL HMAC-SHA512, trang hosted của VNPAY hiển thị QR, IPN là nguồn xác nhận chính và QueryDR có chữ ký là fallback khi IPN trễ/mất; Return chỉ điều hướng về màn hình frontend poll Order. Không đưa `VNPAY_HASH_SECRET` vào frontend và không tự mã hóa payment URL thành QR.

Migration mới là `20261021000000_vnpay_gateway`. Chế độ nghiệm thu là `NEXT_PUBLIC_DATA_MODE=api`; mock/hybrid chỉ còn phục vụ phát triển module khác. Workspace đã có cấu hình VNPAY TEST trong `.env` ignored; ngày 2026-10-22 VNPAY xác nhận đã active `VNPAYQR` cho terminal, còn từ 2026-11-11 backend local để bank code trống để trang hosted tự hiển thị các phương thức TEST được cấp. Chưa đánh dấu sandbox/production VERIFIED_COMPLETE vì URL IPN còn phải được cấu hình trong VSM và chưa quan sát callback IPN thật cho một giao dịch mới. Xem contract hiện hành tại `API_CONTRACT.md` và cấu hình tại `INTEGRATION_GUIDE.md`.

Nhánh đã nhập `origin/main:cff6ff0` ngày 2026-10-22. Hiện có Promotions/Loyalty/LoyaltyLog và Staff cancel từ `main`; VNPAY giữ luồng bất đồng bộ. Sau merge, backend 20 suite/253 test không-DB, backend E2E 6 suite/126 test, frontend 20/20 unit + lint + build và Payment PostgreSQL 7 suite/101 test trên database tạm đủ 13 migration đều PASS. Database tạm đã được xóa. Orders là owner duy nhất của phép cộng điểm khi chuyển PAID; Payment adapter chỉ ghi LoyaltyLog và xóa giỏ trong cùng transaction.

## Lịch sử: cập nhật sau khi nhập origin/main ngày 2026-10-16

Làm việc trên **nhánh hiện có** `feature/auth-and-base`. Không tạo nhánh mới. Nguồn thiết kế vẫn là toàn bộ 9 export `stitch/`; trang hồ sơ và Barista KDS đã được chỉnh theo ảnh, với 5 route Barista. `frontend/src/components/barista-board.tsx` là UI chính, `barista-board.css` là CSS; `frontend/src/app/barista/[view]/page.tsx` dùng cho orders/preparing/ready/history. Customer shell được ẩn trên staff route.

Auth thật có thêm `users.session_version` và migration `20261016000000_session_version`; đăng xuất tăng version để token cũ trả 401, kể cả bản sao cookie. Đây là invalidation ở cấp tài khoản (mọi thiết bị). `/auth/me` vẫn là nguồn khôi phục phiên; response auth có `Cache-Control: no-store`. Cần `prisma migrate deploy` trên DB nhóm trước khi chạy backend build mới. Test trên DB QA `brewlite_auth_test` đã migrate/seed và chạy HTTP smoke; không sửa dữ liệu DB phát triển.

Mock Barista/Customer dùng chung key localStorage `brewlite-demo-orders-v1`; các transition có kiểm tra trạng thái, hủy cần lý do. API adapter dùng `/staff/orders`, `/staff/orders/:id`, `PATCH /status`, `PATCH /cancel` và không fallback khi API mode lỗi. TV4 đã có list/transition; detail riêng, hủy có lý do, danh sách lịch sử terminal và `completedAt` chưa có. PENDING/PAID/PAYMENT_FAILED được hủy trong mock; PREPARING chưa hỗ trợ.

Bằng chứng sau merge: Docker backend build PASS; 18 suites/168 tests PASS trên DB PostgreSQL tạm với đủ 8 migrations, DB tạm đã dọn; frontend build/lint và 13 unit tests PASS. Test HTTP Orders cần thêm `sessionVersion:0` vào fixture để tương thích guard Auth, không đổi nghiệp vụ Orders. TV1 trước merge đã có demo Playwright 4/4 và QA 1440/768/390. TV4 đã thêm OrdersModule/InventoryModule, API khách/staff, snapshot/history, optimistic locking; Staff còn thiếu detail/hủy lý do/history. TV5 tích hợp `transitionInTransaction`; TV6 tích hợp `ORDER_DISCOUNT`. `NEXT_PUBLIC_DATA_MODE` có **mock/hybrid/api**; Auth luôn API thật.

BrewLite 1.0 là bài tập nhóm 6 người, yêu cầu 10 Task trong `docs/IMPLEMENTATION_PLAN.md`. **Chỉ sửa repo `BrewLite_swe-project_1`**. Repo này ban đầu chỉ có 9 export Stitch; đã thêm Next.js frontend và NestJS backend (backend auth/products được lấy làm nền từ dự án BrewLite bên cạnh, sau đó sửa trong repo này). Không sửa `BrewLite_swe_project_2`.

Nguồn giao diện: `stitch/*/code.html`, ảnh tham chiếu `screen.webp` đã nén từ PNG, và `stitch/artisanal_vietnamese_coffee_ordering/DESIGN.md`. Frontend `frontend/src/app`; state giỏ Zustand `frontend/src/stores/cart.ts` (chỉ localStorage, không đồng bộ server từ 2026-10-24); domain model `frontend/src/types/domain.ts`; service interface/adapters `frontend/src/services`. Auth là API thật; Payment đã nối Orders port và đang dùng VNPAY WebPay/IPN. Promotions/Loyalty đã có backend; Staff API còn thiếu endpoint detail riêng. `NEXT_PUBLIC_DATA_MODE` có `mock`, `hybrid`, `api`, không fallback ngầm; thanh toán VNPAY chỉ dùng `api`.

Backend Prisma `backend/prisma/schema.prisma`, migration `backend/prisma/migrations`, auth `backend/src/auth`, products `backend/src/products`, seed Barista qua biến môi trường. Role CUSTOMER/BARISTA. Mọi đơn mới PENDING, thanh toán xác nhận mới PAID; PAYMENT_FAILED giữ giỏ; UNKNOWN không tự thành công; PAID → PREPARING → READY → COMPLETED. Staff có thể hủy với lý do theo state machine hiện hành. Giá tiền số nguyên VND; backend tính lại giá và tồn kho.

Baseline 2026-10-17: backend Prisma generate/build/lint và 18 suites/165 tests không cần DB qua; hai suite/18 test PostgreSQL Payment mock qua trên database tạm riêng với đủ 9 migration. Đây là bằng chứng lịch sử trước VNPAY, không xác nhận gateway/IPN mới. Kết quả kiểm tra hiện hành được ghi ở `PROJECT_STATUS.md` và `TESTING.md`.


## Lịch sử riêng nhánh TV4 trước khi nhập main ngày 2026-10-26

Các bằng chứng dưới đây thuộc code và gateway mock ở thời điểm ghi nhận, không xác nhận phiên bản VNPAY hiện tại.

## TV4 đối chiếu báo cáo và nghiệm thu — 2026-10-18, mới nhất

Giữ nhánh `feature/orders-and-inventory`, nền `6851515`. Báo cáo `(2).docx` mục 12.1 giao Điệp T06/T10A/T10C/backend Barista; đã có đủ nghiệp vụ. Lượt này bổ sung hai bài race HTTP/PostgreSQL và `backend/scripts/verify-tv4-browser.cjs`; không đổi backend nghiệp vụ hoặc frontend. 272/272 backend tests, build/lint/full typecheck PASS. Browser hai phiên login thật, API mode, checkout/payment gateway mô phỏng và staff→customer sync PASS ở 1440/768/390. DB UUID riêng đã dọn.

Xem [TV4_ACCEPTANCE.md](TV4_ACCEPTANCE.md). Backend READY_FOR_REVIEW; TV1 còn nối UI hủy/history/KPI và bỏ thông báo chờ TV4. Runner build lại `.next` cho URL thử nghiệm 33221; sau lượt này đã build lại với cấu hình local và PASS. Nếu chạy lại runner, nhớ trả build về cấu hình API ứng dụng. Kết quả này không xác nhận DB ứng dụng đã migrate hay thay đổi đã push. Các mô tả nhánh cũ dưới đây là lịch sử.

## Backend Barista TV4 — trạng thái được giữ khi nhập main 2026-10-18

Nhánh `feature/orders-and-inventory` giữ API staff detail/cancel reason và terminal history từ commit `abd7343` khi nhập `origin/main:b87db13`. Order có `cancelReason`/`completedAt` qua migration `20261016000100_staff_order_details`; chỉ PENDING/PAID/PAYMENT_FAILED được hủy. Reason, trạng thái, hoàn kho và history nằm cùng transaction/CAS; completedAt ghi lúc READY→COMPLETED. Sau merge đã sửa một fixture Payment dùng lối hủy cũ, rồi backend build local/Docker, lint và **25 suites/270 tests PASS** trên PostgreSQL thật với đủ 11 migrations; DB tạm đã dọn.
