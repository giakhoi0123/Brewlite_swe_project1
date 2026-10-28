# Task 1.1: Bối cảnh Nghiệp vụ, Stakeholders và Phạm vi Dự án BrewLite

- **Đồ án:** BrewLite (Artisanal Vietnamese Coffee Ordering & Cashless Payment)
- **Môn học:** Công nghệ Phần mềm — Khoa CNTT, Đại học Sài Gòn
- **Giảng viên hướng dẫn:** ThS. Từ Lãng Phiêu
- **Người chủ trì:** Phạm Gia Khôi (phối hợp toàn nhóm)

---

## 1. Bối cảnh Nghiệp vụ (Problem Statement)
Tại các quán cà phê truyền thống và hiện đại tại Việt Nam, quy trình phục vụ tại quầy thường gặp phải các hạn chế lớn:
1. **Khách hàng chờ đợi lâu:** Vào giờ cao điểm, khách phải xếp hàng tại quầy để xem menu giấy/bảng tĩnh, chọn kích cỡ, độ ngọt, lượng đá, topping và thanh toán tiền mặt/chờ quét mã QR thủ công.
2. **Sai sót khi tiếp nhận yêu cầu:** Nhân viên quầy (thu ngân/barista) ghi chép thủ công dễ nhầm lẫn các tùy chọn cá nhân hóa (ví dụ: ít ngọt, nhiều đá, đổi loại topping).
3. **Thiếu tính đồng bộ và minh bạch trạng thái:** Khách hàng không biết đồ uống của mình đang ở giai đoạn nào (chờ nhận, đang pha, hay đã sẵn sàng), gây tắc nghẽn tại khu vực nhận nước.
4. **Quản lý tồn kho thụ động:** Không kiểm soát được số lượng nguyên liệu/ly khả dụng theo thời gian thực, dẫn đến tình trạng khách đã thanh toán nhưng quầy lại báo hết món.

**Giải pháp BrewLite:**
BrewLite xây dựng một nền tảng Web App chuẩn Mobile-First / PWA kết hợp hệ thống hiển thị bếp/quầy (Barista KDS), cung cấp luồng đặt món trực tuyến khép kín, thanh toán không tiền mặt mô phỏng với cơ chế giữ tồn kho an toàn và nguồn dữ liệu duy nhất (Single Source of Truth).

---

## 2. Bảng Phân tích Stakeholders (Bên liên quan)

| Stakeholder | Nhu cầu / Kỳ vọng chính | Giá trị nhận được |
| :--- | :--- | :--- |
| **Khách hàng (Customer)** | Xem danh mục món trực quan; tùy chỉnh size/topping/đá/đường; đặt hàng và thanh toán nhanh chóng; theo dõi trạng thái đơn hàng theo thời gian thực; xem lại lịch sử đơn. | Thông tin giá và trạng thái đơn minh bạch; giảm thiểu tối đa thời gian chờ đợi tại quầy; tích lũy điểm thưởng loyalty. |
| **Nhân viên Quầy / Barista** | Tiếp nhận tức thì các đơn hàng đã thanh toán hợp lệ; xem chi tiết công thức tùy chỉnh; cập nhật trạng thái pha chế thuận tiện; hủy đơn hợp lệ khi có sự cố quầy. | Thứ tự xử lý đơn đồng nhất (FIFO); không bị sót đơn; giao tiếp trạng thái với khách hàng tự động không cần gọi loa. |
| **Quản lý Cửa hàng (Manager)** | Kiểm soát doanh thu, luồng vận hành đơn hàng và chất lượng dịch vụ quầy; kiểm soát tồn kho không bị âm hoặc bán khống. | Quy trình đặt - pha chế được số hóa; hạn chế sai sót và thất thoát nguyên liệu; dữ liệu báo cáo chính xác. |
| **Giảng viên / Nhóm Nghiệm thu** | Đối chiếu toàn bộ chuỗi phát triển phần mềm từ tài liệu yêu cầu, mô hình hóa, thiết kế kiến trúc, đến mã nguồn, test và môi trường chạy thực tế. | Khả năng truy vết toàn diện (Traceability); tính trung thực của quy trình Agile/Scrum qua 2 Sprint; bằng chứng CI/CD và deployment thực tế. |
| **Nhóm Phát triển (6 thành viên)** | Phân chia module rõ ràng, phối hợp hiệu quả, kiểm soát thay đổi chặt chẽ qua Git; giao tiếp qua API contract chuẩn xác. | Mỗi thành viên có task ownership rõ ràng, rèn luyện kỹ năng fullstack, CI/CD, viết test tự động và tuân thủ Definition of Done. |
| **Dịch vụ Thanh toán Mô phỏng** | Nhận yêu cầu thanh toán qua Ví điện tử hoặc Thẻ ngân hàng; phản hồi trạng thái xác thực và giao dịch (PAID / PAYMENT_FAILED / UNKNOWN). | Giả lập trọn vẹn hành vi của cổng thanh toán thực tế, hỗ trợ thử nghiệm cơ chế chống gửi lặp (Idempotency) mà không tốn chi phí giao dịch tiền thật. |

---

## 3. Phạm vi Dự án (Project Scope)

### 3.1. Trong phạm vi MVP (In-Scope MVP)
- **Menu & Catalog:** Hiển thị danh mục 10 đồ uống truyền thống; tìm kiếm món theo tên không phân biệt hoa thường; xem chi tiết sản phẩm.
- **Tùy chỉnh & Giỏ hàng:** Chọn Size (S/M/L), Topping (thạch cà phê, kem sữa, hạt sen), định lượng đá và đường, ghi chú cho Barista; giỏ hàng tính tổng tiền server-side; thêm/sửa/xóa món.
- **Xác thực người dùng (Auth):** Đăng ký, đăng nhập tài khoản Khách hàng bằng JWT HttpOnly cookie kết hợp `sessionVersion` bảo mật; mã hóa mật khẩu bằng bcrypt.
- **Tạo đơn hàng:** Kiểm tra tồn kho khả dụng; trừ giữ kho an toàn (`inventoryHeld = true`); lưu snapshot giá sản phẩm tại thời điểm đặt; tạo đơn trạng thái `PENDING`.
- **Thanh toán mô phỏng:** Hỗ trợ 2 phương thức: Ví điện tử (Wallet) và Thẻ ngân hàng (Card); sinh `idempotencyKey` chống trừ tiền lặp khi retry; xử lý các nhánh kết quả `PAID`, `PAYMENT_FAILED` (tự động hoàn kho), và `UNKNOWN`.
- **Theo dõi & Lịch sử:** Trang xác nhận đơn; xem chi tiết đơn hàng; xem danh sách lịch sử đơn của tài khoản; chỉ cho phép người dùng xem đơn của chính mình.
- **Kiểm soát tính toàn vẹn:** Áp dụng Database Transaction bảo vệ luồng tạo đơn và thanh toán; ngăn chặn tuyệt đối tình trạng race condition bán vượt tồn kho.

### 3.2. Phạm vi Mở rộng của Nhóm (Team Extensions)
- **Giao diện Màn hình Barista (KDS - Kitchen Display System):** Màn hình dành riêng cho nhân viên quầy (`/barista/dashboard`), phân quyền bằng Role `BARISTA`.
- **Quản lý Hàng đợi & Tiến trình Pha chế:** Barista xem danh sách đơn đã thanh toán, tiếp nhận đơn (`PREPARING`), báo món hoàn tất (`READY`), và giao món thành công (`COMPLETED`) kèm ghi nhận mốc thời gian `completedAt`.
- **Hủy đơn có lý do:** Cho phép Barista hủy đơn khi có sự cố quầy (bắt buộc nhập lý do từ 1-300 ký tự); hệ thống tự động hoàn trả tồn kho vào database.

### 3.3. Ngoài phạm vi thực hiện (Out of Scope)
- Không xử lý giao dịch tiền thật qua tài khoản ngân hàng hoặc ví thương mại (MoMo, ZaloPay, VNPay thật).
- Không triển khai dịch vụ giao hàng tận nơi (Delivery / Shipper) và định vị GPS.
- Không tích hợp hệ thống kế toán doanh nghiệp (ERP), hóa đơn điện tử cơ quan thuế.
- Không hỗ trợ chuỗi cửa hàng đa chi nhánh (hệ thống vận hành cho 1 cửa hàng chuẩn).

### 3.4. Ràng buộc Kỹ thuật Bắt buộc (Constraints)
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Zustand, mobile-first responsive.
- **Backend:** NestJS, TypeScript, kiến trúc module hóa (Modular Architecture), class-validator, bcrypt, JWT.
- **Database:** PostgreSQL 15, quản lý schema và migrations bằng Prisma ORM.
- **Ảo hóa:** Docker và Docker Compose cho cả môi trường phát triển cục bộ và đóng gói triển khai.
- **Quy tắc nghiệm thu:** API Backend luôn là nguồn xác nhận duy nhất (Single Source of Truth) về giá, tồn kho và trạng thái đơn; dữ liệu mock chỉ phục vụ kiểm thử cục bộ cô lập.

