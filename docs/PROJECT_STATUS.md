# Trạng thái dự án

Cập nhật mới nhất TV4 (2026-10-15, sửa checkout HTTP 500): schema hiện dùng `Order.statusHistory` nhưng create order còn gửi `history`, gây Prisma `Unknown argument history`. Đã đồng bộ service/test và dùng `satisfies Prisma.OrderUncheckedCreateInput` để bắt sai tên field khi build. Docker backend đã rebuild và cập nhật container. **146/146 backend tests qua, gồm 8 PostgreSQL tests, không skipped**; test HTTP dùng cookie JWT + Origin thật và PostgreSQL tạo đơn L+topping 45.000đ → 201/PENDING, có history, stock giảm đúng. Các test concurrency/rollback cũng qua. Database kiểm thử riêng tự tạo đã được dọn sau test; dữ liệu ứng dụng không dùng làm fixture. Những ghi chú DB/Docker chưa chạy và 7 skipped phía dưới là lịch sử, đã được thay thế bằng kết quả này. Browser checkout của người dùng còn cần thử lại; chưa xác nhận payment TV5.

Cập nhật sửa lỗi Docker TV4 (2026-10-15): phát hiện UTF-8 BOM ở đầu `backend/prisma/schema.prisma` gây Prisma P1012 trong image Linux. Đã loại bỏ BOM, giữ nguyên nội dung schema; Prisma validate/generate và backend build local qua, bước generate/build trong Docker cũng qua. Docker CLI hiện đã có; người dùng báo PostgreSQL healthy. Các blocker Docker/DB ở phần lịch sử bên dưới mô tả phiên trước; chưa dùng thông tin này để xác nhận bộ PostgreSQL tests mới.

`UI_COMPLETED` nghĩa là màn hình/adapter có code và build, chưa nghĩa là backend thật đã hoàn tất. Cập nhật cùng `IMPLEMENTATION_PLAN.md` sau mỗi mốc.

Ảnh tham chiếu Stitch được nén thành `screen.webp`; icon ứng dụng được thu nhỏ còn 256 px. Các file này chỉ phục vụ đối chiếu thiết kế và nhận diện ứng dụng, không thay đổi chức năng.

Cây thư mục và bản đồ chức năng để bàn giao/đánh giá được duy trì trong `docs/PROJECT_STRUCTURE.md` và liên kết từ README.

Đã đối chiếu lại `screen.webp` của trang chủ, auth, chi tiết món và giỏ hàng: hero ảnh xếp lớp, danh sách món, bố cục auth hai cột, nhóm tùy chọn và tóm tắt giỏ đã được chỉnh gần thiết kế Stitch hơn. Kiểm tra desktop 1440 px và mobile 390 px không thấy tràn ngang; build/lint và 3 frontend unit tests qua. Backend auth vẫn cần chạy để thử đăng nhập thực tế.

| Feature | Frontend | Backend | Tests | Owner | Ghi chú |
|---|---|---|---|---|---|
| Menu, chi tiết | UI_COMPLETED (chi tiết làm lại theo Stitch 2026-10-15) | Products API VERIFIED_COMPLETE | Build/lint/unit qua; smoke Edge desktop+mobile mock qua; Playwright e2e cần chạy lại | TV1/TV2/TV3 | Mock và API adapter |
| Giỏ | UI_COMPLETED (làm lại theo Stitch 2026-10-15) | Không yêu cầu riêng | Build/lint/unit qua; smoke Edge đổi size/voucher/tổng qua; Playwright e2e cần chạy lại | TV1/TV3 | Zustand persist |

Ngày 2026-10-15 (nhánh `feature/cart_productDetail`): trang chi tiết và giỏ hàng được dựng lại theo `product_details/` và `cart/` (Stitch). Chi tiết: thẻ size, topping, mức đá/đường, ghi chú cho Barista (`CartItem.note`), "Mua ngay", mô tả theo nhóm món, gợi ý món có "Thêm nhanh". Giỏ: đổi size ngay trong giỏ (tự gộp nếu trùng cấu hình), mã ưu đãi lưu trong store và được checkout áp dụng sẵn. E2E đã đổi selector sang "Size M" và "Tiến hành đặt hàng" nhưng chưa chạy lại vì máy chưa cài Chromium của Playwright và backend/DB chưa chạy.
| Auth | UI_COMPLETED | Code đầy đủ | 37 backend tests; PostgreSQL HTTP; Playwright đăng ký/role qua | TV1 | Cookie JWT và role |
| Checkout / Orders | UI_COMPLETED | IN_PROGRESS (code TV4 đã có) | Unit/HTTP giá, DTO, guard, stock/state qua; PostgreSQL/E2E thật chưa chạy | TV1/TV4 | Có POST PENDING, GET mine/detail/status; bật api mode để dùng backend |
| Payment | UI_COMPLETED | BACKEND_PENDING | Playwright fail/retry/success/unknown qua | TV1/TV5 | PAID/FAILED/UNKNOWN demo |
| Lịch sử/tracking | UI_COMPLETED | IN_PROGRESS | GET orders/me/detail/status có backend TV4; DB/E2E chưa xác minh | TV1/TV4/TV6 | Snapshot item giữ nguyên giá/tên cũ; TV6 tiếp tục history integration |
| Promotion/Loyalty | UI_COMPLETED | BACKEND_PENDING | Playwright mã sai/đúng, điểm sau PAID qua | TV1/TV6 | BREW10 chỉ demo |
| Barista | UI_COMPLETED | IN_PROGRESS | HTTP role/DTO tests qua; state machine đủ 49 cặp | TV1/TV4 | Có GET/PATCH staff orders; chưa xác minh DB/browser |
| Docker | VERIFIED_COMPLETE ở mốc trước | Không chạy trong phiên 2026-10-15 TV4 | Docker CLI không có; DB localhost:5434 ECONNREFUSED | TV1 | Không dùng bằng chứng phiên cũ để xác nhận migration mới |

## TV4 — 2026-10-15, feature/orders-and-inventory

Đã triển khai T06/10A/10C: migration `20261015000100_orders_inventory`, giá backend, snapshot món/topping, history, transaction tạo đơn + giữ kho, CAS stock Product.version và CAS Order.version, release một lần khi failed/cancel, reserve lại khi retry. CUSTOMER chỉ xem đơn của mình; BARISTA không được tự xác nhận thanh toán. Tích hợp TV5 qua `OrdersService.transitionInTransaction`; TV6 qua provider `ORDER_DISCOUNT`. Không thêm backend Payment/Promotion/Loyalty giả.

Prisma generate/validate và backend build/lint qua. Backend có 138 test qua, 7 test PostgreSQL **skipped** vì chưa có `ORDERS_TEST_DATABASE_URL`. Test thật trên PostgreSQL được viết cho tranh chấp 8 request/1 sản phẩm, rollback đa món, lỗi ghi đơn, hủy đồng thời, retry hết kho, rollback payment và snapshot lịch sử. Migration mới chỉ được tạo offline, chưa apply. Chưa đánh dấu VERIFIED_COMPLETE cho phạm vi TV4.

Checkout giữ phong cách UI cũ, dùng service API hiện có kèm cookie; xử lý lỗi/loading, chống submit đồng thời, điều hướng theo ID server và tránh POST lần nữa khi sessionStorage lỗi sau tạo đơn. GET status dùng JSON `{status}` và adapter unwrap. Bật `NEXT_PUBLIC_DATA_MODE=api` + restart/build frontend để dùng backend; mode mock vẫn dành cho demo. Thanh toán thật sau PENDING còn phụ thuộc TV5.

Blocker: không có Docker CLI, DB cấu hình `localhost:5434/brewlite` từ chối kết nối; cần chạy migration và PostgreSQL/browser E2E sau khi DB sẵn sàng. Typecheck mở rộng toàn bộ backend tests còn lỗi fixture Products có sẵn (thiếu stock/description), ngoài phần TV4; build ứng dụng và Jest vẫn qua. Kết quả frontend cuối cùng và lệnh tái lập xem `docs/TESTING.md`.
