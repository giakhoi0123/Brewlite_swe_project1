# Trạng thái dự án

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
| Checkout | UI_COMPLETED | BACKEND_PENDING | Playwright promo sai/đúng, auth redirect qua | TV1/TV4 | Demo tạo PENDING |
| Payment | UI_COMPLETED | BACKEND_PENDING | Playwright fail/retry/success/unknown qua | TV1/TV5 | PAID/FAILED/UNKNOWN demo |
| Lịch sử/tracking | UI_COMPLETED | BACKEND_PENDING | Playwright list/detail/timeline qua | TV1/TV6 | localStorage demo |
| Promotion/Loyalty | UI_COMPLETED | BACKEND_PENDING | Playwright mã sai/đúng, điểm sau PAID qua | TV1/TV6 | BREW10 chỉ demo |
| Barista | UI_COMPLETED | BACKEND_PENDING | Playwright PAID→COMPLETED và role guard qua | TV1/TV4 | Staff Orders API chưa có |
| Docker | VERIFIED_COMPLETE | PostgreSQL chạy | Compose build, 3 container và HTTP qua | TV1 | Cổng DB 5434 |
