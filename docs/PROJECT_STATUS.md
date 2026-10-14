# Trạng thái dự án

`UI_COMPLETED` nghĩa là màn hình/adapter có code và build, chưa nghĩa là backend thật đã hoàn tất. Cập nhật cùng `IMPLEMENTATION_PLAN.md` sau mỗi mốc.

Ảnh tham chiếu Stitch được nén thành `screen.webp`; icon ứng dụng được thu nhỏ còn 256 px. Các file này chỉ phục vụ đối chiếu thiết kế và nhận diện ứng dụng, không thay đổi chức năng.

| Feature | Frontend | Backend | Tests | Owner | Ghi chú |
|---|---|---|---|---|---|
| Menu, chi tiết | VERIFIED_COMPLETE | Products API VERIFIED_COMPLETE | Playwright API mode + DB HTTP qua | TV1/TV2/TV3 | Mock và API adapter |
| Giỏ | VERIFIED_COMPLETE | Không yêu cầu riêng | Playwright persist/totals/clear qua | TV1/TV3 | Zustand persist |
| Auth | UI_COMPLETED | Code đầy đủ | 37 backend tests; PostgreSQL HTTP; Playwright đăng ký/role qua | TV1 | Cookie JWT và role |
| Checkout | UI_COMPLETED | BACKEND_PENDING | Playwright promo sai/đúng, auth redirect qua | TV1/TV4 | Demo tạo PENDING |
| Payment | UI_COMPLETED | BACKEND_PENDING | Playwright fail/retry/success/unknown qua | TV1/TV5 | PAID/FAILED/UNKNOWN demo |
| Lịch sử/tracking | UI_COMPLETED | BACKEND_PENDING | Playwright list/detail/timeline qua | TV1/TV6 | localStorage demo |
| Promotion/Loyalty | UI_COMPLETED | BACKEND_PENDING | Playwright mã sai/đúng, điểm sau PAID qua | TV1/TV6 | BREW10 chỉ demo |
| Barista | UI_COMPLETED | BACKEND_PENDING | Playwright PAID→COMPLETED và role guard qua | TV1/TV4 | Staff Orders API chưa có |
| Docker | VERIFIED_COMPLETE | PostgreSQL chạy | Compose build, 3 container và HTTP qua | TV1 | Cổng DB 5434 |
