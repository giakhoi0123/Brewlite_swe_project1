# Trạng thái dự án

## Ảnh chụp trạng thái mới nhất — 2026-10-16, TV1

| Phần | UI có mã | Đã so Stitch | Chức năng FE đã test | Backend thật | Test backend/API | Phần còn chờ |
|---|---|---|---|---|---|---|
| Menu/chi tiết/giỏ/checkout/payment/order | Có | 9 export đã xem; các trang chính đã chụp QA 1440/768/390 | Demo E2E 4/4; unit 8/8 | Products/Cart thật; Orders/Payment endpoint chưa nối | Products/Cart đã kiểm tra trước; chưa test Orders API | TV4–TV6 |
| Hồ sơ/điểm | Có; thẻ thành viên, lịch sử đơn, trạng thái voucher | Hồ sơ đối chiếu Stitch; 3 viewport không tràn | E2E điểm sau PAID; browser QA | Auth thật; Loyalty mock | Auth DB HTTP PASS; Loyalty API chưa có | TV6 |
| Auth | Có | Login/register đối chiếu Stitch | Đăng ký, đăng nhập, refresh, role, logout trong E2E | NestJS/PostgreSQL thật, JWT version | Jest backend 59/59, HTTP smoke DB QA PASS | Deploy migration trên DB dùng chung |
| Barista | 5 route, KDS, KPI, chi tiết, xác nhận, hủy, lịch sử | Barista Stitch và QA 3 viewport | Unit + E2E workflow/hủy PASS | Chỉ adapter mock; Staff Orders API chưa có | API integration SKIPPED | TV4 |

`UI_COMPLETED` của Barista và các module khách hàng không đồng nghĩa backend nghiệp vụ đã xong. Auth là phần TV1 đã kiểm chứng với DB QA riêng. Bản QA frontend chạy cổng 3006, backend cổng 3005; không đụng DB phát triển đang dùng. Nội dung dưới đây ghi lịch sử các lượt trước, không thay thế bảng trạng thái mới nhất.

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
| Checkout | UI_COMPLETED | BACKEND_PENDING | Playwright promo sai/đúng, auth redirect qua | TV1/TV4 | Demo tạo PENDING |
| Payment | UI_COMPLETED | IN_PROGRESS | Sau khi hợp nhất Cart + Payment: frontend 7/7 unit + build; backend 56/56 + build | TV1/TV5 | Core/schema/migration có; chờ Orders port và API E2E thật |
| Lịch sử/tracking | UI_COMPLETED | BACKEND_PENDING | Playwright list/detail/timeline qua | TV1/TV6 | localStorage demo |
| Promotion/Loyalty | UI_COMPLETED | BACKEND_PENDING | Playwright mã sai/đúng, điểm sau PAID qua | TV1/TV6 | BREW10 chỉ demo |
| Barista | UI_COMPLETED | BACKEND_PENDING | Playwright PAID→COMPLETED và role guard qua | TV1/TV4 | Staff Orders API chưa có |

Ngày 2026-10-15 (nhánh `feature/cart_productDetail`):
- UI chi tiết và giỏ dựng lại theo Stitch (`product_details/`, `cart/`): thẻ size, topping, mức đá/đường, ghi chú cho Barista (`CartItem.note`), "Mua ngay", gợi ý món "Thêm nhanh"; giỏ đổi size tại chỗ, voucher lưu trong store và checkout áp dụng sẵn.
- Backend giỏ theo tài khoản: bảng `carts`/`cart_items` (migration `20261015000000_add_cart`), module `backend/src/cart`. Giá không lưu mà luôn tính lại từ Product khi đọc; dòng trùng cấu hình được gộp; chặn vượt tồn kho (409); size/topping không hợp lệ 422; giỏ riêng từng user. `cart-pricing.ts` là hàm tính giá dùng chung, TV4 có thể tái sử dụng cho `POST /orders`.
- Frontend: `CartService` (mock + REST), `components/cart-sync.tsx` gộp giỏ khách lên server khi đăng nhập, xóa bản sao khi đăng xuất. Khách vãng lai vẫn dùng Zustand như cũ.
- Thêm `NEXT_PUBLIC_DATA_MODE=hybrid`: sản phẩm + giỏ hàng gọi backend thật, đơn/thanh toán/ưu đãi/điểm/Barista vẫn mock (`demoOrders` điều khiển phần UI demo). Kiểm tra trên trình duyệt Edge + PostgreSQL: thêm, thêm món thứ 2, tăng số lượng, đổi size, xóa món, thanh toán demo PAID (giỏ server được xóa), xóa tất cả — 8/8, mỗi bước đối chiếu trực tiếp bảng `cart_items`.
- Sửa selector E2E mơ hồ `getByText('Tạm hết')` (trang chủ hiện có 2 chữ "Tạm hết" từ commit `0e669c8`).
| Docker | VERIFIED_COMPLETE | PostgreSQL chạy | Compose build, 3 container và HTTP qua | TV1 | Cổng DB 5434 |
