# ADR-002: Backend NestJS theo Module/Domain và PostgreSQL với Prisma ORM

- **Trạng thái:** ACCEPTED
- **Ngày quyết định:** 2026-10-24
- **Người đề xuất:** Nguyễn Văn Đông, Lê Quang Điệp
- **Thành viên review:** Toàn nhóm (6 thành viên)

## 1. Bối cảnh (Context)
Hệ thống BrewLite có nhiều miền nghiệp vụ ràng buộc chặt chẽ: Sản phẩm/Tùy chọn, Giỏ hàng, Đặt đơn, Giữ/Hoàn tồn kho, Xử lý giao dịch thanh toán và Phân quyền Barista KDS.
Các bài toán cốt lõi đòi hỏi tính toàn vẹn dữ liệu cực cao:
- Chống race condition (hai khách hàng tranh mua sản phẩm cuối cùng tại cùng một thời điểm).
- Đảm bảo snapshot giá của đơn hàng không bị thay đổi khi danh mục sản phẩm cập nhật giá trong tương lai.
- Chuyển trạng thái đơn hàng tuân thủ nghiêm ngặt máy trạng thái hữu hạn (State Machine).

## 2. Các phương án xem xét (Options Considered)
1. **Phương án A - TypeORM / Raw SQL:**
   - *Ưu điểm:* Quen thuộc trong hệ sinh thái NestJS cũ.
   - *Nhược điểm:* Migration tự động của TypeORM dễ gây mất tính nhất quán; type safety chưa đạt mức tuyệt đối; transaction phức tạp.
2. **Phương án B - Prisma ORM kết hợp PostgreSQL 15:**
   - *Ưu điểm:* Khai báo schema tập trung trong `schema.prisma`; sinh code client an toàn kiểu dữ liệu 100% (Type-safe); cơ chế Prisma Migrate quản lý các file SQL migration có phiên bản rõ ràng; hỗ trợ Interactive Transactions an toàn tuyệt đối với khóa hàng `FOR UPDATE`.

## 3. Quyết định (Decision)
Chọn **NestJS Modular Architecture** kết hợp **PostgreSQL 15** và **Prisma ORM**:
1. **Phân ranh giới Module rõ ràng:**
   - `AuthModule`: Xác thực JWT, bcrypt băm mật khẩu, `sessionVersion` để vô hiệu hóa toàn bộ phiên làm việc khi logout.
   - `ProductsModule`: Quản lý danh mục, biến thể size, topping, phân trang và tìm kiếm.
   - `CartModule`: Quản lý giỏ hàng của user; giá không lưu cố định trong DB mà tính động tại server-side để chống can thiệp giá từ client.
   - `OrdersModule`: Máy trạng thái đơn hàng (`OrderStatus`), trừ giữ kho (`inventoryHeld = true`), lưu snapshot chi tiết vào `OrderItem` và `OrderItemTopping`, lưu vết `OrderStatusHistory`.
   - `PaymentsModule`: Xử lý thanh toán mô phỏng, ghi nhật ký giao dịch, kiểm soát khóa lạc quan / khóa hàng.
   - `InventoryModule`: Cung cấp cổng độc lập để giữ kho khi tạo đơn và hoàn trả kho khi đơn bị hủy / thanh toán thất bại.
2. **Quản lý Migration & Seed:**
   - Sử dụng 11 bản migration SQL chuẩn trong `backend/prisma/migrations/` để tái tạo cơ sở dữ liệu sạch trên bất kỳ môi trường nào.
   - Viết tập lệnh seed (`seed.ts`) tạo sẵn 10 món cà phê và trà truyền thống, bảng tùy chọn size/topping và tài khoản mẫu cho Barista & Khách hàng.
3. **Bảo vệ toàn vẹn bằng Transaction:**
   - Luồng tạo đơn (`POST /orders`) và thanh toán (`POST /payments`) bắt buộc phải bọc trong `prisma.$transaction()` với mức cô lập phù hợp.

## 4. Đánh đổi & Hệ quả (Trade-offs & Consequences)
- **Tích cực:** Độ tin cậy và toàn vẹn dữ liệu đạt mức tối đa; 272/272 tests tự động kiểm thử concurrency và transaction thành công 100%.
- **Tiêu cực:** Prisma ORM đòi hỏi chạy bước sinh mã (`prisma generate`) trong chuỗi CI/CD và Docker build.

