# ADR-003: Cổng Thanh toán Mô phỏng và Cơ chế Chống Gửi lặp (Idempotency)

- **Trạng thái:** ACCEPTED
- **Ngày quyết định:** 2026-10-24
- **Người đề xuất:** Lê Quang Điệp, Nguyễn Tuấn Kiệt
- **Thành viên review:** Toàn nhóm (6 thành viên)

## 1. Bối cảnh (Context)
Đề bài Assignment 2 yêu cầu mô phỏng thanh toán không dùng tiền mặt qua Ví điện tử (Wallet) hoặc Thẻ ngân hàng (Card). Không tích hợp tiền thật từ cổng MoMo/VNPay trực tiếp.
Tuy nhiên, trong thương mại điện tử, các rủi ro kỹ thuật sau đây luôn xảy ra và phải được xử lý triệt để:
1. **Network Retries / Double-clicking:** Người dùng bấm thanh toán 2 lần do mạng chập chờn hoặc UI chưa khóa nút bấm.
2. **Inconsistent State:** Cổng thanh toán trừ tiền thành công nhưng kết nối mạng bị đứt trước khi hệ thống cập nhật đơn hàng thành `PAID`.
3. **Double Reservation:** Trừ tồn kho 2 lần hoặc hoàn kho sai thời điểm.

## 2. Các phương án xem xét (Options Considered)
1. **Phương án A - Giao diện thanh toán giả lập đơn giản:**
   - Client tự sinh kết quả `success` và gọi API chuyển trạng thái đơn.
   - *Hạn chế:* Dễ gian lận, không phản ánh kiến trúc microservice/gateway thực tế, vi phạm nguyên tắc server-side source of truth.
2. **Phương án B - Cổng mô phỏng Adapter với Idempotency Key và Journaling bền vững:**
   - Client sinh `idempotencyKey` (UUIDv4) cho mỗi phiên thanh toán.
   - Server lưu vết nhật ký trạng thái giao dịch (`Payment` với cờ `gatewayStatus`) trước và sau khi xử lý.
   - Cơ sở dữ liệu đặt ràng buộc `UNIQUE(user_id, idempotency_key)`.

## 3. Quyết định (Decision)
Chọn **Phương án B**:
1. **Giao thức Idempotency Key:**
   - Mọi request gọi `POST /api/payments` bắt buộc truyền `idempotencyKey: UUID`.
   - Backend tra cứu trong bảng `payments`. Nếu cặp `(userId, idempotencyKey)` đã tồn tại:
     - Hệ thống thực hiện cơ chế **Replay Response**: trả lại ngay lập tức kết quả giao dịch trước đó kèm HTTP 200 OK.
     - Tuyệt đối không gọi lại cổng thanh toán, không trừ tiền lại, không cộng dồn điểm loyalty thưởng lần thứ hai.
2. **Khóa hàng (Row-level Locking) cho Order:**
   - Sử dụng lệnh `SELECT FOR UPDATE` trên bản ghi `Order` tương ứng để ngăn chặn 2 yêu cầu thanh toán đồng thời xử lý song song trên cùng một mã đơn hàng.
3. **Nhật ký Gateway (Journaling):**
   - Bản ghi `Payment` được khởi tạo với trạng thái `PROCESSING`.
   - Kết quả phản hồi từ Cổng thanh toán được ghi nhận vào cột `gateway_status` trước khi commit thay đổi trạng thái của `Order`.
4. **Quy tắc chuyển trạng thái & Hoàn kho:**
   - `PAID`: Đơn hàng chuyển sang `PAID`, điểm thưởng loyalty được cộng tự động, giỏ hàng được dọn sạch (`DELETE /cart`).
   - `PAYMENT_FAILED`: Đơn hàng chuyển sang `PAYMENT_FAILED`, cơ chế hoàn trả tồn kho tự động được kích hoạt ngay lập tức (`stock = stock + qty`, `inventoryHeld = false`). Cho phép khách hàng chọn phương thức khác và gửi lại với **idempotencyKey mới**.
   - `UNKNOWN` (Timeout / Lỗi mạng): Ghi nhận `gatewayStatus = UNKNOWN`, giữ nguyên `Order` ở `PENDING` và tiếp tục giữ tồn kho để chờ đối soát, không vội vàng hủy hay hoàn kho.

## 4. Đánh đổi & Hệ quả (Trade-offs & Consequences)
- **Tích cực:** Đáp ứng trọn vẹn tiêu chuẩn ngân hàng/thương mại điện tử thực tế; ngăn chặn 100% rủi ro trừ tiền kép hoặc sai lệch tồn kho; đã được kiểm chứng bằng test suite `payment-consistency.postgres.spec.ts`.
- **Tiêu cực:** Client cần lưu trữ và quản lý chu kỳ sống của `idempotencyKey` trong giao diện người dùng.

