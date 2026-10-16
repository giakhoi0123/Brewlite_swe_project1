# Trạng thái dự án

## Backend Barista TV4 — 2026-10-16 (mốc mới nhất)

Đã bổ sung GET staff detail, PATCH cancel bắt buộc reason 1–300 ký tự sau trim, `cancelReason`/`completedAt`, tên khách và danh sách staff gồm cả COMPLETED/CANCELLED. Hủy chỉ từ PENDING/PAID/PAYMENT_FAILED; API status không nhận CANCELLED. Reason, trạng thái, hoàn kho và history cùng transaction/CAS; COMPLETED ghi thời điểm bàn giao. Migration mới chỉ thêm cột và backfill completedAt từ lịch sử thật của đơn cũ.

Kiểm chứng: Prisma generate, backend build local/Docker và lint PASS; **19 suites, 191 tests PASS, 0 skipped**, gồm **22 PostgreSQL tests** (14 Staff mới + 8 Orders). Đã apply đủ 9 migrations trên database tạm riêng và dọn đúng DB đó; DB ứng dụng chưa được migrate trong lượt này. Chi tiết tại TESTING.md. Typecheck toàn bộ test vẫn có 3 lỗi fixture Products đã tồn tại; không có lỗi ở file TV4 mới.

Phần backend yêu cầu đã kiểm chứng. Chưa đánh dấu toàn bộ Barista/T06/T10 VERIFIED_COMPLETE: TV1 còn bật history/KPI/nút hủy trong API mode và chạy browser E2E; Payments/hoàn tiền thuộc TV5, Promotions/Loyalty thuộc TV6. Các bảng phía dưới là trạng thái ở các mốc trước.

## Ảnh chụp trạng thái sau khi nhập origin/main — 2026-10-16

| Phần | UI có mã | Đã so Stitch | Chức năng FE đã test | Backend thật | Test backend/API | Phần còn chờ |
|---|---|---|---|---|---|---|
| Menu/chi tiết/giỏ/checkout/payment/order | Có | 9 export đã xem; các trang chính đã chụp QA 1440/768/390 | Demo E2E 4/4 trước merge; unit 13/13 sau merge | Products/Cart/Orders code thật; Payment endpoint chưa nối | Mã tích hợp 168/168 backend tests trên PostgreSQL QA | Payment TV5, Promo TV6, API browser E2E |
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

Payment frontend đã bổ sung payment intent có kiểm tra dữ liệu, giữ đúng phương thức khi retry, xử lý lỗi khi xác minh và chỉ xóa intent/giỏ sau PAID. Backend đã có Payments core, DTO/controller, mock gateway, Prisma schema/migration và idempotency claim; chưa đăng ký vào AppModule vì đang chờ OrdersModule của TV4 cung cấp `PAYMENT_ORDER_PORT`.

| Feature | Frontend | Backend | Tests | Owner | Ghi chú |
|---|---|---|---|---|---|
| Menu, chi tiết | VERIFIED_COMPLETE (chi tiết làm lại theo Stitch 2026-10-15) | Products API VERIFIED_COMPLETE | Playwright (Edge) mock 3/3 + API mode 2/2 qua | TV1/TV2/TV3 | Mock và API adapter |
| Giỏ | VERIFIED_COMPLETE (làm lại theo Stitch 2026-10-15) | Cart API VERIFIED_COMPLETE (`/cart`, PostgreSQL) | 11 backend tests; smoke HTTP DB thật 12/12; luồng trình duyệt API mode 8/8; unit mock cart | TV1/TV3 | Khách: Zustand persist; đăng nhập: giỏ lưu server |
| Auth | UI_COMPLETED | Code đầy đủ | 37 backend tests; PostgreSQL HTTP; Playwright đăng ký/role qua | TV1 | Cookie JWT và role |
| Checkout / Orders | UI_COMPLETED | IN_PROGRESS (code TV4 đã có) | Unit/HTTP giá, DTO, guard, stock/state qua; PostgreSQL/E2E thật chưa chạy | TV1/TV4 | Có POST PENDING, GET mine/detail/status; bật api mode để dùng backend |
| Payment | UI_COMPLETED | IN_PROGRESS | Sau khi hợp nhất Cart + Payment: frontend 7/7 unit + build; backend 56/56 + build | TV1/TV5 | Core/schema/migration có; chờ Orders port và API E2E thật |
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
