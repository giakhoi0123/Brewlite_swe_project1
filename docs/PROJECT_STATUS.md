# Trạng thái dự án

`UI_COMPLETED` nghĩa là màn hình/adapter có code và build, chưa nghĩa là backend thật đã hoàn tất. Cập nhật cùng `IMPLEMENTATION_PLAN.md` sau mỗi mốc.

| Feature | Frontend | Backend | Tests | Owner | Ghi chú |
|---|---|---|---|---|---|
| Menu, chi tiết | UI_COMPLETED | Products API có mã | Backend tests qua; DB chưa chạy | TV1/TV2/TV3 | Mock và API adapter |
| Giỏ | UI_COMPLETED | Không yêu cầu riêng | Build qua | TV1/TV3 | Zustand persist |
| Auth | UI_COMPLETED | Code đầy đủ | 37 backend tests qua, DB chưa chạy | TV1 | Cookie JWT và role |
| Checkout | UI_COMPLETED | BACKEND_PENDING | Build và mock tests qua | TV1/TV4 | Demo tạo PENDING |
| Payment | UI_COMPLETED | BACKEND_PENDING | Build và mock tests qua | TV1/TV5 | PAID/FAILED/UNKNOWN demo |
| Lịch sử/tracking | UI_COMPLETED | BACKEND_PENDING | Build qua | TV1/TV6 | localStorage demo |
| Promotion/Loyalty | UI_COMPLETED | BACKEND_PENDING | Build qua | TV1/TV6 | BREW10 chỉ demo |
| Barista | UI_COMPLETED | BACKEND_PENDING | RBAC backend tests qua | TV1/TV4 | Staff Orders API chưa có |
| Docker | Có compose và Dockerfile | DB chưa chạy | BLOCKED | TV1 | Docker daemon không hoạt động |
