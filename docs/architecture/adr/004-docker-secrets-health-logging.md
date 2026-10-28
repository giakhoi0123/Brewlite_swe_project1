# ADR-004: Triển khai Container hóa, Quản lý Cấu hình/Secrets, Health Check và Logging

- **Trạng thái:** ACCEPTED
- **Ngày quyết định:** 2026-10-24
- **Người đề xuất:** Nguyễn Tuấn Kiệt, Trần Thế Duy
- **Thành viên review:** Toàn nhóm (6 thành viên)

## 1. Bối cảnh (Context)
Yêu cầu của Task 3, Task 4 và Task 5 đặt ra các tiêu chuẩn phi chức năng nghiêm ngặt:
- Hệ thống phải có khả năng triển khai lại nhất quán trên mọi môi trường (Local máy cá nhân của 6 thành viên, CI Runner của GitHub, và Production Cloud Host).
- Bảo mật thông tin: Tuyệt đối không commit secrets (JWT secret, mật khẩu DB, API keys) vào Git repository hoặc in ra logs màn hình.
- Giám sát độ sẵn sàng (Availability): Cần có cơ chế kiểm tra sức khỏe hệ thống tự động (Health Check endpoint) phục vụ Container Orchestrator và bài kiểm thử khói (Smoke Test) sau khi deploy.
- Cơ sở dữ liệu không được phép mở cổng trực tiếp ra Internet trên môi trường production.

## 2. Các phương án xem xét (Options Considered)
1. **Phương án A - Cài đặt trực tiếp (Bare-metal / Manual PM2):**
   - Khó tái tạo môi trường giống nhau giữa các thành viên dùng Windows, macOS và Linux.
2. **Phương án B - Container hóa toàn diện bằng Docker & Docker Compose:**
   - Đóng gói toàn bộ runtime Node.js và PostgreSQL vào các container chuẩn hóa; cô lập mạng nội bộ (bridge network).

## 3. Quyết định (Decision)
Chọn **Phương án B - Container hóa bằng Docker & Docker Compose**:
1. **Kiến trúc Container:**
   - `brewlite_web`: Container chạy Next.js (port 3000).
   - `brewlite_api`: Container chạy NestJS (port 3001).
   - `brewlite_postgres`: Container chạy PostgreSQL 15 Alpine, gắn Volume bền vững `brewlite_pg`.
   - Kết nối giữa API và Database diễn ra hoàn toàn bên trong Docker Network nội bộ (`postgres:5432`). Trên production, cổng database không bind ra host.
2. **Quản lý Secrets & Biến môi trường:**
   - Tách biệt cấu hình khỏi mã nguồn theo nguyên tắc 12-Factor App.
   - Thư mục gốc chứa `.env.example` với các giá trị mẫu an toàn.
   - File `.env` chứa bí mật thật được đưa vào `.gitignore`. Trong CI/CD, biến môi trường được truyền qua GitHub Repository Secrets (`DATABASE_URL`, `JWT_SECRET`, `DOCKERHUB_TOKEN`).
   - Bộ lọc logging đảm bảo không bao giờ in token JWT, password hash hoặc thông tin nhạy cảm vào stdout/stderr.
3. **Health Check Endpoint:**
   - Triển khai endpoint công khai `GET /health` (hoặc `GET /api/health`).
   - Endpoint thực hiện truy vấn nhẹ `SELECT 1` kiểm tra kết nối cơ sở dữ liệu và trả về `{ status: "ok", timestamp, database: "connected" }` kèm HTTP 200.
   - Sử dụng cho Docker healthcheck và CI smoke test sau khi release.
4. **Quy trình Deploy & Rollback:**
   - Mỗi commit merge vào `main` kích hoạt GitHub Actions build image Docker gắn tag theo Commit SHA và Semantic Versioning (`v1.0.0`).
   - Nếu bài kiểm thử khói (Smoke test) tại `GET /health` thất bại, pipeline tự động dừng và kích hoạt lệnh rollback về container image của phiên bản ổn định trước đó.

## 4. Đánh đổi & Hệ quả (Trade-offs & Consequences)
- **Tích cực:** Môi trường hoàn toàn nhất quán; kiểm soát bảo mật chặt chẽ; đáp ứng 100% tiêu chí NFR-02, NFR-03, NFR-05 của Assignment 2.
- **Tiêu cực:** Yêu cầu máy phát triển phải cài đặt Docker Desktop và tiêu tốn thêm tài nguyên RAM/CPU khi chạy đồng thời 3 container.

