# BrewLite 1.0 — Đối chiếu đề bài và phần mở rộng Barista

> **Tài liệu đối chiếu**, không phải kết luận đạt 10/10. Nguồn: đề giảng viên `BrewLite-CongNghePhanMem.pdf` (8 trang); đối chiếu `main` tại commit `2c45463acc301db2251622190065763e8d787b38` ngày 25/10/2026. Các test được nhắc đến dựa trên báo cáo trong repository, không phải lượt chạy mới.

## 1. Phạm vi và quy tắc chấm

Đề bài có **10 task Scrum, mỗi task 1 điểm**. MVP gồm menu, chi tiết size/topping, giỏ, JWT, tạo đơn, thanh toán không tiền mặt bằng **cổng thanh toán giả lập với lựa chọn Ví/Thẻ**, xác nhận và lịch sử. Task 10 bắt buộc state machine, idempotency, kiểm soát tồn kho đồng thời, khuyến mãi và điểm tích lũy.

**Barista là phạm vi mở rộng do nhóm tự đề xuất.** Đề thầy ghi rõ nhân viên quầy/Barista ngoài phạm vi MVP; phân hệ Barista phải được thuyết minh độc lập và **không thay thế bất kỳ task bắt buộc nào**.

## 2. Ma trận đối chiếu 10 task

| Task | Trạng thái đối chiếu mã nguồn | Điểm cần nghiệm thu |
| --- | --- | --- |
| 1. Khởi tạo monorepo | Có Next.js + NestJS, README, Compose và cấu hình mẫu | Clean install, build, khởi động |
| 2. GET /products | Có module API sản phẩm | Trả JSON id/tên/giá/ảnh từ DB |
| 3. Menu frontend | Có trang menu | Loading, empty, error |
| 4. Chi tiết sản phẩm | Có size/topping và tính giá | Thử lựa chọn hợp lệ/bất hợp lệ |
| 5. Cart | Có giỏ Zustand | Thêm/sửa/xóa, badge, refresh, tổng tiền |
| 6. POST /orders | Có nghiệp vụ Orders, kiểm kho | Validate, lưu PENDING, mã đơn, rollback |
| 7. JWT | Có auth, RBAC, guard | Đăng ký/đăng nhập, chặn truy cập sai |
| 8. Mock Ví/Thẻ | **Chưa khớp đề:** DTO chỉ chấp nhận `VNPAY_QR` | Bổ sung luồng mô phỏng Ví/Thẻ riêng, giữ nguyên VNPAY là tính năng nâng cao |
| 9. Xác nhận, lịch sử, bàn giao | Có UI/Orders API/Compose/README | Demo E2E theo Task 8 từ menu tới lịch sử |
| 10. Nghiệp vụ backend | Có state machine, idempotency, inventory, promotions và loyalty | Test tích hợp trên bản cuối; sửa kiểm chứng voucher và atomic redeem |

Chưa đưa ra **điểm số cuối cùng** nếu chưa có bản build/demo/test chấm theo Definition of Done.

## 3. Phân hệ Barista — phần mở rộng của nhóm

### 3.1. Lý do mở rộng

Đề giới hạn MVP đến xác nhận thanh toán, nhưng nhóm xây thêm màn quản lý pha chế để mô phỏng quy trình vận hành thực tế tại quầy, nối tiếp các trạng thái đơn hàng đã có trong backend. Tác nhân `BARISTA` được phân quyền tách với `CUSTOMER`.

### 3.2. User Stories mở rộng

- **US14 — Tiếp nhận đơn chờ pha:** Là Barista, tôi muốn xem đơn đã thanh toán và nhận pha chế để xử lý đúng thứ tự. Acceptance: chỉ BARISTA truy cập; danh sách đơn từ API thật; chỉ đơn `PAID` được bắt đầu pha, chuyển sang `PREPARING`.
- **US15 — Pha chế và giao đơn:** Là Barista, tôi muốn chuyển `PREPARING → READY → COMPLETED` để khách theo dõi đúng tiến độ. Acceptance: backend kiểm tra state transition; frontend khách đọc trạng thái mới từ cùng dữ liệu; lỗi API không báo thành công.
- **US16 — Hủy đơn khi có sự cố:** Là Barista, tôi muốn nêu lý do và hủy đơn trong trạng thái cho phép để dừng xử lý đơn không đáp ứng được. Acceptance: yêu cầu lý do; giới hạn trạng thái, RBAC; không báo đã hoàn tiền nếu chưa xử lý refund.

### 3.3. Giao diện và backend đã có

Frontend xây **5 view** tại `frontend/src/components/barista-board.tsx`, được định tuyến qua `frontend/src/app/barista/dashboard/page.tsx` và `frontend/src/app/barista/[view]/page.tsx`:

1. Tổng quan
2. Đơn chờ pha
3. Đang pha chế
4. Chờ giao
5. Lịch sử xử lý

Các endpoint nghiệp vụ nhân viên có thật tại `backend/src/orders/staff-orders.controller.ts`, với `JwtAuthGuard`, `RolesGuard`, `@Roles(Role.BARISTA)`:

- `GET /staff/orders` — danh sách đơn phục vụ màn hình Barista.
- `PATCH /staff/orders/:id/status` — cập nhật trạng thái.
- `PATCH /staff/orders/:id/cancel` — hủy đơn kèm lý do.

**Lưu ý kỹ thuật:** `GET /barista/dashboard` trong `backend/src/barista/barista.controller.ts` vẫn trả `{ message, orders: [] }` dạng placeholder. Không mô tả endpoint này là dữ liệu dashboard thật. Backend chưa có endpoint `GET /staff/orders/:id` dù adapter frontend từng có khai báo tương ứng; kiểm chứng lại khi tích hợp.

### 3.4. Test nên bổ sung cho Barista

1. CUSTOMER gọi endpoint staff nhận 403; BARISTA hợp lệ được phép.
2. `PAID → PREPARING → READY → COMPLETED` thành công; state trái phép bị chặn.
3. Hai nhân viên thao tác đồng thời không tạo chuyển trạng thái bất nhất.
4. Hủy phải có lý do hợp lệ, đúng trạng thái; đơn đã hủy không quay lại queue.
5. Màn hình khách và nhân viên cùng phản ánh trạng thái thực từ PostgreSQL.
6. Chạy frontend ở chế độ API thật, không chỉ mock.

## 4. Các sửa chữa bắt buộc nên ưu tiên

1. **Task 8:** hiện `backend/src/payments/dto/create-payment.dto.ts` dùng `@IsIn(['VNPAY_QR'])`. Thầy yêu cầu lựa chọn Ví/Thẻ mock, xử lý cả `PAID` và `PAYMENT_FAILED`. Tách chế độ demo với VNPAY Sandbox thay vì sửa điều kiện sang Ví/Thẻ rồi tuyên bố đã có luồng thực.
2. **Voucher:** `backend/src/promotions/voucher-rules.ts` cho nhận mã `REDEEM...` theo prefix/mệnh giá ngay cả khi không tìm thấy record; cần kiểm tra voucher được phát hành trong DB và chủ sở hữu.
3. **Đổi điểm:** `backend/src/loyalty/loyalty.service.ts` tách đọc số dư và cập nhật trừ điểm; cần giao dịch nguyên tử có điều kiện và lưu voucher chắc chắn trước khi trả thành công.
4. **Promotions controller:** rà soát route `POST /promotions/validate` đang được đăng ký từ hai controller.
5. **Người dùng và nghiệm thu:** lưu log thực cho E2E, kiểm thử đồng thời, 500ms với dữ liệu mẫu, trạng thái loading/lỗi và trình duyệt; báo cáo rõ phần chưa hoàn thành.

## 5. Quy trình Scrum và bàn giao

Thầy yêu cầu phân công **PO, Scrum Master, Development Team**; minh chứng **Sprint Planning, Daily Scrum, Sprint Review, Retrospective**; **Product Backlog, Sprint Backlog, Increment** và burndown dựa trên số liệu thật (không tạo số liệu giả). Kế hoạch đề gợi ý: Sprint 1 task 1–4, Sprint 2 task 5–7, Sprint 3 task 8–10.

**Definition of Done:** code không lỗi build, đạt acceptance criteria, có commit và review, API validate, UI loading/error, README chạy được. Bàn giao qua demo menu → tùy chỉnh → giỏ → đăng nhập → PENDING → thanh toán Ví/Thẻ mock → xác nhận/lịch sử; xuất trình Git/Compose/README; ghi feedback và Retrospective.

## 6. Lưu ý khi cập nhật báo cáo LaTeX

Trong báo cáo cần gắn nhãn rõ **[BẮT BUỘC]** cho US01–US13, **[MỞ RỘNG CỦA NHÓM — BARISTA]** cho US14–US16. Giữ phân công nhóm đã thống nhất; không suy ra thành viên nào đã hoàn thành code chỉ từ phân công soạn User Stories. Phiên bản PDF và LaTeX đầy đủ được soạn riêng để nhóm sử dụng khi nộp; file này chỉ là checklist có thể review trực tiếp trên GitHub.
