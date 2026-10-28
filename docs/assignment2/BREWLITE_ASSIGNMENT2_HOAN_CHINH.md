# HỒ SƠ DỮ LIỆU TOÀN DIỆN BÁO CÁO ASSIGNMENT 2 — ĐỒ ÁN BREWLITE
## MÔN CÔNG NGHỆ PHẦN MỀM — KHOA CÔNG NGHỆ THÔNG TIN — ĐẠI HỌC SÀI GÒN
> **Giảng viên hướng dẫn:** ThS. Từ Lãng Phiêu  
> **Đề tài:** Ứng dụng Đặt hàng & Nhà hàng (BrewLite - Artisanal Vietnamese Coffee Ordering & Cashless Payment)  
> **Nhóm sinh viên thực hiện (6 thành viên):**  
> 1. Phạm Gia Khôi  
> 2. Võ Minh Tri  
> 3. Nguyễn Văn Đông  
> 4. Lê Quang Điệp *(Lead / Owner Task 1.3 & Payment/Inventory)*  
> 5. Trần Thế Duy  
> 6. Nguyễn Tuấn Kiệt  

---

# 1. TỔNG QUAN ASSIGNMENT 2

### 1.1. Phạm vi sản phẩm
- **Tên dự án:** BrewLite (Nền tảng Đặt cà phê và Thanh toán không tiền mặt).
- **Mục tiêu:** Tiếp tục đề tài BrewLite, thực hiện trọn vẹn chuỗi công việc công nghệ phần mềm: từ khai thác yêu cầu, mô hình hóa hệ thống, thiết kế kiến trúc, hiện thực qua 2 Sprint (Sprint 1 MVP Menu, Sprint 2 Hoàn chỉnh luồng đặt hàng & Barista KDS), thiết lập tự động hóa CI/CD và triển khai thực tế có thể truy cập được qua Internet.
- **Luồng nghiệp vụ tối thiểu bắt buộc:**
  $$\text{Xem menu} \longrightarrow \text{Chọn tùy chọn (Size/Topping)} \longrightarrow \text{Giỏ hàng} \longrightarrow \text{Đặt đơn} \longrightarrow \text{Thanh toán} \longrightarrow \text{Theo dõi đơn}$$
- **Công nghệ bắt buộc (Chuẩn đề bài):**
  - **Frontend:** `Next.js 14/15` (App Router, TypeScript, Tailwind CSS, Zustand, thiết kế theo hướng mobile-first và PWA).
  - **Backend:** `NestJS` (TypeScript, kiến trúc module hóa Modular/Domain, class-validator, JWT, bcrypt).
  - **Cơ sở dữ liệu:** `PostgreSQL 15` (quản trị schema và 11 migrations bằng `Prisma ORM`).
  - **Ảo hóa & Đóng gói:** `Docker` & `Docker Compose` (`web` cổng 3000, `api` cổng 3001, `postgres` cổng 5434 host / 5432 nội bộ).
  - **Thanh toán:** Cổng thanh toán Ví điện tử (Wallet) và Thẻ ngân hàng (Card) là mô phỏng (Simulated Gateway), có kiểm soát Idempotency Key.
- **Phần mở rộng của nhóm:** Màn hình Kitchen Display System (KDS) dành riêng cho Nhân viên quầy / Barista (`/barista/dashboard`) với phân quyền Role `BARISTA`: tiếp nhận các đơn đã thanh toán theo thứ tự FIFO, cập nhật tiến trình `PREPARING -> READY -> COMPLETED` (lưu mốc `completedAt`), hoặc hủy đơn hợp lệ kèm lý do (tự động hoàn trả tồn kho).

---

# 2. QUY TRÌNH TỪ YÊU CẦU ĐẾN TRIỂN KHAI

Hệ thống được triển khai tuần tự nghiêm ngặt qua 5 Task lớn (mỗi Task 2 điểm, tổng 10 điểm):

| Task | Giai đoạn thực hiện | Tạo phẩm chính bắt buộc | Điểm |
| :---: | :--- | :--- | :---: |
| **Task 1** | Khai thác và đặc tả yêu cầu | Bảng Stakeholder, phạm vi MVP/mở rộng/ngoài lề, SRS rút gọn, 15 User Stories (US-01..15) kèm tiêu chí chấp nhận AC, 9 Yêu cầu chức năng (FR), 6 Yêu cầu phi chức năng (NFR), Use-case trọng tâm Đặt & thanh toán (UC-CHK). | **2.0** |
| **Task 2** | Mô hình hóa hệ thống | Activity Diagram luồng end-to-end có swimlanes và nhánh lỗi; Sequence Diagram đặt/thanh toán có 5 lifelines, transaction và idempotency; Class Diagram domain tối thiểu 7 thực thể. File nguồn `.puml` và bản xuất trong `docs/diagrams/`. | **2.0** |
| **Task 3** | Thiết kế kiến trúc | Mô tả kiến trúc phân lớp & C4; 4 bản Quyết định kiến trúc chi tiết (ADR-001 đến ADR-004); Deployment Diagram thực tế thể hiện ranh giới Local, CI và Production. | **2.0** |
| **Task 4** | Triển khai Sprint 1 | Thiết lập Git monorepo, quy ước branch/PR/commit, issue board/backlog, DoD, lưu trữ docs/, hoàn thành MVP Menu mobile-first chạy được (`GET /products`, `GET /products/:id`), seed dữ liệu mẫu, pipeline CI chặn lỗi. | **2.0** |
| **Task 5** | Triển khai Sprint 2, CI/CD và Delivery | Hoàn thiện MVP đặt hàng, giỏ hàng, auth JWT, thanh toán mô phỏng idempotency, KDS Barista; 272/272 tests tự động; pipeline CD tự động đóng gói Docker image, push registry, deploy production, smoke test `GET /health` và rollback. | **2.0** |
| **Tổng** | **Toàn bộ đồ án** | **5 Task hoàn thành tuần tự và minh chứng trên Git** | **10.0** |

---

# 3. TASK 1 – KHAI THÁC VÀ ĐẶC TẢ YÊU CẦU

### 3.1. Task 1.1 – Bối cảnh, Stakeholder và Phạm vi
- **Bối cảnh:** Tại các quán cà phê truyền thống, khách hàng thường mất nhiều thời gian xếp hàng tại quầy để xem menu giấy, nhân viên dễ nhầm lẫn các yêu cầu tùy chỉnh (độ ngọt, lượng đá, loại topping), trạng thái pha chế thiếu minh bạch và nguy cơ bán vượt số lượng tồn kho thực tế. Hệ thống BrewLite cung cấp luồng đặt món số hóa, thanh toán không tiền mặt và nguồn dữ liệu duy nhất (Single Source of Truth).

#### Bảng phân tích 6 Stakeholders:
| Stakeholder | Nhu cầu / Kỳ vọng | Giá trị nhận được |
| :--- | :--- | :--- |
| **Khách hàng (Customer)** | Xem menu sinh động, tùy chỉnh đồ uống nhanh chóng, đặt món và thanh toán tiện lợi, theo dõi trạng thái đơn hàng trực tiếp. | Biết rõ giá thành và trạng thái đơn hàng; tiết kiệm thời gian chờ đợi; xem lại lịch sử đơn và tích điểm loyalty. |
| **Nhân viên Quầy / Barista** | Tiếp nhận chính xác các đơn hàng đã thanh toán, nắm rõ công thức tùy chỉnh, cập nhật trạng thái pha chế đơn giản. | Thứ tự phục vụ chuẩn xác (FIFO); không bị sót đơn; giao tiếp trạng thái với khách hàng tự động. |
| **Quản lý Cửa hàng** | Theo dõi toàn bộ hoạt động bán hàng, quản lý doanh thu và chất lượng phục vụ của quầy. | Kiểm soát quy trình chặt chẽ; tránh thất thoát nguyên liệu; dữ liệu báo cáo chuẩn xác. |
| **Giảng viên / Nhóm nghiệm thu** | Đối chiếu chuỗi phát triển từ tài liệu yêu cầu, thiết kế kiến trúc, mã nguồn, kiểm thử đến môi trường chạy thực tế. | Khả năng truy vết toàn diện (Traceability); tính trung thực của quy trình phần mềm và lịch sử Git. |
| **Nhóm Phát triển (6 TV)** | Phân chia module rành mạch, phối hợp hiệu quả, kiểm soát mã qua Git PR và Definition of Done. | Có task ownership rõ ràng, API contract chuẩn mực, tích lũy kinh nghiệm làm việc nhóm chuẩn Agile. |
| **Dịch vụ Thanh toán Mô phỏng**| Nhận yêu cầu thanh toán Ví/Thẻ, giả lập phản hồi kết quả giao dịch và hỗ trợ xử lý lỗi mạng/retry. | Mô phỏng chính xác hành vi cổng thanh toán thực tế; cho phép kiểm tra cơ chế Idempotency mà không tốn phí. |

#### 3.1.1. Phạm vi dự án
- **Trong MVP:** Xem menu 10 sản phẩm, tìm kiếm món, xem chi tiết và tùy chọn size/topping/đá/đường, quản lý giỏ hàng, xác thực tài khoản JWT cookie HttpOnly, tạo đơn PENDING (trừ giữ kho), thanh toán mô phỏng Ví/Thẻ (Idempotency), xem lịch sử đơn, theo dõi trạng thái, bảo vệ toàn vẹn bằng transaction.
- **Mở rộng nhóm:** Màn hình KDS Barista (`/barista/dashboard`), phân quyền Role `BARISTA`, hàng đợi đơn đã thanh toán, chuyển trạng thái `PREPARING -> READY -> COMPLETED` (lưu mốc `completedAt`), hủy đơn hợp lệ kèm lý do (1-300 ký tự) và tự động hoàn trả kho.
- **Ngoài phạm vi:** Giao dịch tiền thật (MoMo/VNPay thật), giao hàng tận nơi (shipper), tích hợp ERP kế toán và quản lý chuỗi đa chi nhánh.
- **Ràng buộc:** Bắt buộc dùng Next.js, NestJS, PostgreSQL 15, Prisma ORM, Docker Compose; API Backend là nguồn xác thực duy nhất về giá, tồn kho và thanh toán.

---

### 3.2. Task 1.2 – User Story, Yêu cầu Chức năng (FR) và Phi Chức năng (NFR)

#### Danh mục 15 User Stories chuẩn:
- **US-01 (Must - Task 1, 4):** Là khách hàng, tôi muốn xem menu gồm tên, giá, ảnh và trạng thái món để chọn đồ uống.
- **US-02 (Should - Task 1, 4):** Là khách hàng, tôi muốn tìm món theo tên/từ khóa để nhanh chóng chọn được sản phẩm.
- **US-03 (Must - Task 1, 5):** Là khách hàng, tôi muốn xem chi tiết và chọn size/topping để tùy chỉnh đồ uống.
- **US-04 (Must - Task 1, 5):** Là khách hàng, tôi muốn thêm/sửa/xóa món trong giỏ và thấy tổng tiền cập nhật đúng.
- **US-05 (Must - Task 1, 5):** Là khách hàng, tôi muốn đăng ký/đăng nhập để tạo đơn bằng tài khoản của mình.
- **US-06 (Must - Task 1, 5):** Là khách hàng đã đăng nhập, tôi muốn tạo đơn từ giỏ để hệ thống ghi nhận món cần đặt.
- **US-07 (Must - Task 1, 5):** Là khách hàng, tôi muốn thanh toán bằng Ví/Thẻ mô phỏng để hoàn tất đơn không tiền mặt.
- **US-08 (Must - Task 1, 5):** Là khách hàng, tôi muốn nhận xác nhận, xem lịch sử và theo dõi trạng thái đơn.
- **US-09 (Must - Task 1, 5):** Là hệ thống, tôi muốn chống xử lý thanh toán lặp để không ghi nhận giao dịch hai lần.
- **US-10 (Must - Task 1, 5):** Là hệ thống, tôi muốn kiểm tra tồn kho an toàn khi nhiều khách đặt đồng thời.
- **US-11 (Must - Task 1, 5):** Là hệ thống, tôi muốn chỉ cho phép chuyển trạng thái đơn theo vòng đời hợp lệ.
- **US-12 (Should - Task 1, 5):** Là khách hàng, tôi muốn áp dụng mã giảm giá hợp lệ để giảm số tiền thanh toán.
- **US-13 (Could - Task 1, 5):** Là khách hàng, tôi muốn được cộng điểm sau thanh toán thành công để tích lũy quyền lợi.
- **US-14 (Extension - Task 1, 5):** Là Barista, tôi muốn xem và tiếp nhận đơn đã thanh toán để pha chế đúng thứ tự.
- **US-15 (Extension - Task 1, 5):** Là Barista, tôi muốn cập nhật READY/COMPLETED hoặc hủy đơn hợp lệ để thông báo đúng tiến trình.

#### 3.2.1. Yêu cầu Chức năng (FR):
- **FR-01 (Menu/Catalog - Must):** Xem, tìm kiếm, xem chi tiết sản phẩm và tình trạng còn hàng (`GET /products`, `GET /products/:id`).
- **FR-02 (Tùy chỉnh/Giỏ - Must):** Chọn size/topping; thêm, sửa, xóa món; tính tổng tiền server-side (`/cart`, `CartStore`).
- **FR-03 (Tài khoản - Must):** Đăng ký, đăng nhập, xác thực JWT HttpOnly cookie, phân quyền RBAC (`POST /auth/register`, `POST /auth/login`).
- **FR-04 (Đặt hàng - Must):** Kiểm tra giỏ/tồn kho, tính giá server-side, tạo đơn PENDING và giữ tồn kho (`POST /orders`).
- **FR-05 (Thanh toán - Must):** Thanh toán mô phỏng Ví/Thẻ; lưu kết quả; xử lý retry/idempotency key (`POST /payments`).
- **FR-06 (Theo dõi đơn - Must):** Xác nhận đơn, lịch sử, trạng thái; chỉ cho phép khách xem đơn của mình (`GET /orders/me`, `GET /orders/:id`).
- **FR-07 (Vòng đời/Tồn kho - Must):** Chuyển trạng thái theo State Machine; transaction ngăn bán vượt tồn kho; hoàn kho khi hủy.
- **FR-08 (Promotion/Loyalty - Should/Could):** Áp dụng mã giảm giá; tích lũy điểm thưởng sau khi thanh toán thành công (`10.000đ = 1 điểm`).
- **FR-09 (Barista Extension - Could):** Xem hàng đợi KDS, cập nhật `PREPARING/READY/COMPLETED`, hủy theo điều kiện kèm lý do.

#### 3.2.2. Yêu cầu Phi Chức năng (NFR):
- **NFR-01 (Hiệu năng):** Phản hồi API menu < 200ms; xử lý tạo đơn và thanh toán < 1.000ms. Đo lường qua `products.benchmark.mjs`.
- **NFR-02 (Bảo mật):** Mật khẩu băm `bcrypt`; JWT lưu cookie `HttpOnly, SameSite=Lax`; kiểm tra quyền RBAC; secrets không commit vào Git hay logs.
- **NFR-03 (Tính sẵn sàng):** Có endpoint `GET /health`; hệ thống tự phục hồi lỗi kết nối DB; giao diện xử lý đủ 4 trạng thái (Loading, Empty, Error, Retry).
- **NFR-04 (Tính toàn vẹn):** Database Transaction bảo vệ tạo đơn và trừ kho; cơ chế Idempotency chống ghi nhận giao dịch kép; khóa lạc quan `version`.
- **NFR-05 (Khả năng triển khai):** Web, API, Database khởi chạy lại nhất quán bằng 1 lệnh `docker compose up --build`; cấu hình tách biệt qua `.env`.
- **NFR-06 (Khả năng bảo trì):** Kiến trúc module rõ ràng (NestJS Modular & Next.js App Router); toàn bộ code dùng TypeScript nghiêm ngặt; test coverage đạt 272/272 tests PASS.

#### 3.2.3. Sơ đồ Use-case Tổng quát:
*(File nguồn đã lưu tại: `docs/diagrams/use-case-system.puml`)*
- Thể hiện 3 Actor: `Khách hàng (Customer)`, `Nhân viên Barista (Staff)`, `Cổng thanh toán mô phỏng (Simulated Gateway)`.
- Gồm 6 phân hệ: Quản lý Menu, Giỏ hàng & Đặt hàng, Thanh toán, Theo dõi đơn, Tài khoản và Quầy Barista KDS.
- Các quan hệ `<<include>>` (Đặt hàng include Giữ kho, Thanh toán include Idempotency) và `<<extend>>` (Tìm kiếm extend Menu, Hoàn kho extend Thanh toán thất bại, Tích điểm extend Thanh toán thành công).

#### 3.2.4. Tiêu chí Chấp nhận Tổng quát:
1. Menu xử lý mượt mà trạng thái loading/empty/error; tìm kiếm không phân biệt hoa thường và thông báo rõ khi không tìm thấy món.
2. Giá đơn hàng bắt buộc do Backend tính toán lại; từ chối tạo đơn nếu giỏ hàng rỗng hoặc sản phẩm không hợp lệ.
3. Đơn hàng khởi tạo ở trạng thái `PENDING`; thanh toán thành công chuyển `PAID`, thất bại chuyển `PAYMENT_FAILED` (tự hoàn kho).
4. Vòng đời đơn hàng tuân thủ: `PENDING -> PAID -> PREPARING -> READY -> COMPLETED`. Đơn bị hủy (`CANCELLED`) bắt buộc có lý do từ 1-300 ký tự.
5. Người dùng chỉ xem được đơn hàng của chính mình; API bảo vệ bằng JWT cookie; tồn kho không bao giờ âm; retry thanh toán không bao giờ bị trừ tiền lần hai.

---

### 3.3. Task 1.3 – Use-case Trọng tâm: Đặt và Thanh toán Đơn hàng (UC-CHK)
*(Đặc tả chi tiết tại `docs/requirements/use-case-checkout.md`, sơ đồ tại `docs/diagrams/use-case-checkout-draft.puml`)*
- **Tên Use-case:** Đặt và thanh toán đơn hàng (Checkout & Cashless Payment).
- **Actor chính:** Khách hàng (Customer). **Actor phụ:** Cổng thanh toán mô phỏng (Simulated Gateway).
- **Tiền điều kiện:** Khách hàng đã đăng nhập tài khoản hợp lệ; giỏ hàng có ít nhất một món hợp lệ; các món còn đủ số lượng tồn kho khả dụng.
- **Hậu điều kiện thành công:** Đơn hàng được lưu bền vững ở trạng thái `PAID`; thanh toán được ghi nhận; khách nhận mã xác nhận; điểm thưởng được cộng; giỏ hàng được dọn sạch; đơn hiển thị trên KDS Barista.
- **Hậu điều kiện thất bại:** Kết quả thất bại được ghi nhận; đơn chuyển sang `PAYMENT_FAILED`; tồn kho được hoàn trả ngay lập tức; khách có thể thử thanh toán lại với Idempotency Key mới.

#### 5 bước cơ bản theo đề & 10 bước chi tiết kỹ thuật:
1. **Bước 1:** Khách hàng xem giỏ hàng, xác nhận các món đã chọn và chọn phương thức Ví điện tử hoặc Thẻ ngân hàng.
2. **Bước 2:** Hệ thống kiểm tra JWT session, xác thực sản phẩm, tùy chọn size/topping, giá và kiểm tra tồn kho; tính lại tổng tiền server-side.
3. **Bước 3:** Hệ thống tạo đơn hàng `PENDING` trong Database Transaction, trừ giữ tồn kho (`inventoryHeld = true`), lưu snapshot giá vào `OrderItem` và trả `orderId`.
4. **Bước 4:** Giao diện Next.js sinh `idempotencyKey: UUID` và gửi yêu cầu `POST /payments`. Cổng thanh toán mô phỏng xử lý và trả về kết quả (PAID / PAYMENT_FAILED / UNKNOWN).
5. **Bước 5:** Nếu thành công: hệ thống ghi nhận thanh toán, chuyển đơn sang `PAID`, cộng điểm loyalty, xóa giỏ hàng và chuyển hướng đến trang Xác nhận đơn. Nếu thất bại: chuyển đơn sang `PAYMENT_FAILED`, hoàn trả kho ngay lập tức và hiển thị thông báo lỗi cho khách xử lý. Nếu timeout: ghi nhận `UNKNOWN`, giữ đơn `PENDING` để đối soát.

---

# 4. TASK 2 – MÔ HÌNH HÓA HỆ THỐNG

### 4.1. Task 2.1 – Activity Diagram (docs/diagrams/activity-checkout.puml)
- Thể hiện trọn vẹn luồng nghiệp vụ End-to-End từ lúc khách duyệt menu đến khi Barista hoàn tất đồ uống.
- Phân chia qua **6 Swimlanes** rõ rệt: `Khách hàng (Customer)`, `Giao diện Next.js (Frontend)`, `NestJS API (Backend)`, `PostgreSQL (Database)`, `Cổng Thanh toán (Mock Gateway)`, và `Nhân viên Barista (Staff)`.
- Xử lý đầy đủ các điểm rẽ nhánh (Decisions):
  - Nhánh chưa đăng nhập: Chuyển hướng sang `/login`, xác thực xong quay lại checkout.
  - Nhánh hết hàng: Báo HTTP 409 Conflict, yêu cầu khách cập nhật lại giỏ.
  - Nhánh trùng Idempotency Key: Replay kết quả trước, không gọi gateway, không trừ tiền kép.
  - Nhánh thanh toán lỗi: Chuyển `PAYMENT_FAILED`, tự động hoàn trả tồn kho, cung cấp nút "Thử lại".
  - Nhánh thanh toán timeout: Ghi nhận `UNKNOWN`, giữ nguyên reservation kho để đối soát.
  - Luồng pha chế KDS: `PREPARING -> READY -> COMPLETED` (ghi nhận mốc thời gian hoàn tất `completedAt`).

### 4.2. Task 2.2 – Sequence Diagram (docs/diagrams/sequence-checkout.puml)
- Đáp ứng tối thiểu **5 Lifelines** chuẩn đề bài:
  $$\text{Customer} \longrightarrow \text{Next.js UI} \longrightarrow \text{NestJS API} \longrightarrow \text{PostgreSQL (Prisma)} \longrightarrow \text{Payment Service}$$
- **Phần 1 - Khởi tạo đơn (`POST /api/orders`):**
  - Next.js UI gửi kèm cookie JWT `brewlite_session`.
  - Backend mở Interactive Transaction: khóa dòng `SELECT stock, version FROM products WHERE id IN (...) FOR UPDATE`.
  - Nếu đủ hàng: trừ tồn kho, tạo Order `PENDING`, lưu snapshot chi tiết `OrderItem`, ghi nhận `OrderStatusHistory (PENDING)`. Trả về `201 Created`.
- **Phần 2 - Xử lý thanh toán (`POST /api/payments`):**
  - UI sinh `idempotencyKey = UUIDv4()`.
  - Backend kiểm tra bảng `payments`: Nếu trùng key thì Replay response trước đó.
  - Nếu key mới: Khóa dòng Order, ghi Payment `PROCESSING`, gọi `MockPaymentGateway.processPayment()`.
  - Nhánh Alt Thành công (`PAID`): Cập nhật Order `PAID`, cộng điểm loyalty, xóa `CartItem`, ghi nhận history `PAID`.
  - Nhánh Alt Thất bại (`PAYMENT_FAILED`): Cập nhật Order `PAYMENT_FAILED`, hoàn trả tồn kho (`stock = stock + qty`).
  - Nhánh Alt Timeout (`UNKNOWN`): Ghi nhận `gatewayStatus = UNKNOWN`, giữ nguyên reservation kho.

### 4.3. Task 2.3 – Class Diagram (docs/diagrams/class-domain.puml)
Bao gồm đầy đủ **7 lớp miền nghiệp vụ (Domain Classes)** theo yêu cầu:
1. **`User`:** Quản lý tài khoản, mật khẩu băm, role (`CUSTOMER`, `BARISTA`), `loyaltyPoints`, `sessionVersion`.
2. **`Product`:** Thông tin món cà phê, giá gốc, tồn kho (`stock`), khóa lạc quan (`version`).
3. **`Order`:** Đơn hàng, `status` (`PENDING..COMPLETED`), tổng tiền, `inventoryHeld`, `cancelReason`, `completedAt`.
4. **`OrderItem`:** Snapshot bất biến của sản phẩm khi đặt: `basePrice`, `sizePrice`, `unitPrice`, `qty`, `lineTotal`, đá, đường, ghi chú.
5. **`Payment`:** Giao dịch thanh toán, `amount`, `method` (`WALLET`/`CARD`), `status`, `gatewayStatus`, `idempotencyKey`.
6. **`Promotion`:** Mã giảm giá, loại chiết khấu, giá trị tối thiểu, hạn sử dụng, trạng thái kích hoạt.
7. **`LoyaltyTransaction`:** Giao dịch điểm thưởng, số điểm cộng/trừ, loại giao dịch (`EARN`/`REDEEM`).
- *Các lớp hỗ trợ liên kết:* `ProductSize`, `Topping`, `ProductTopping`, `OrderItemTopping`, `OrderStatusHistory`, `Cart`, `CartItem`.
- Thể hiện đầy đủ thuộc tính, kiểu dữ liệu, phương thức, các Enum chuẩn và quan hệ kèm multiplicity chính xác.

---

# 5. TASK 3 – THIẾT KẾ KIẾN TRÚC

### 5.1. Task 3.1 – Phương pháp và Quyết định Kiến trúc (ADR)
Hệ thống được thiết kế theo kiến trúc phân tầng kết hợp mô hình C4:
- **Presentation Tier:** Next.js App Router (PWA, Tailwind CSS, Zustand, responsive 1440/768/390px).
- **Application & Domain Tier:** NestJS Modular Architecture (`AuthModule`, `ProductsModule`, `CartModule`, `OrdersModule`, `PaymentsModule`, `InventoryModule`).
- **Persistence Tier:** PostgreSQL 15 quản trị qua Prisma ORM với 11 migrations SQL phiên bản rõ ràng.
- **External Integration:** Adapter `MockPaymentGateway` mô phỏng phản hồi ví điện tử/thẻ ngân hàng.

#### Tóm tắt 4 Quyết định Kiến trúc (ADR) trong `docs/architecture/adr/`:
- **ADR-001 (Monorepo):** Hợp nhất `frontend/` và `backend/` vào 1 repo duy nhất; chia sẻ Type contract; đồng bộ pipeline CI/CD và Docker Compose; quản lý mã và tài liệu thống nhất.
- **ADR-002 (NestJS Modular & Prisma PostgreSQL):** Phân chia ranh giới module rõ ràng; quản lý dữ liệu an toàn kiểu dữ liệu 100%; sử dụng Interactive Database Transaction và khóa dòng `SELECT FOR UPDATE` ngăn chặn tuyệt đối tình trạng race condition bán vượt tồn kho.
- **ADR-003 (Mock Payment & Idempotency):** Áp dụng chuẩn ngân hàng với `idempotencyKey: UUID`; cơ chế Replay response khi gửi lặp; cơ chế Journaling trạng thái gateway trước khi chốt đơn; tự động hoàn trả tồn kho ngay khi giao dịch thất bại.
- **ADR-004 (Triển khai, Secrets, Health Check & Logging):** Đóng gói 3 container qua Docker Compose; bảo vệ secrets bằng `.env` và CI secrets (không commit vào repo); cung cấp endpoint `GET /health` giám sát DB/API; pipeline CD tự động kiểm tra smoke test và hỗ trợ rollback.

### 5.2. Task 3.2 – Deployment Diagram (docs/diagrams/deployment.puml)
- **Node Client:** Thiết bị người dùng (Smartphone / Desktop PC), Trình duyệt / PWA Client, Service Worker cache, Cookie Jar lưu JWT `brewlite_session`.
- **Node Mạng & Bảo mật:** Reverse Proxy / TLS Termination (HTTPS cổng 443 chuyển tiếp nội bộ cổng 3000/3001).
- **Node Production (Docker Compose / Cloud Host):**
  - `brewlite_web`: Container Next.js Production (Port 3000).
  - `brewlite_api`: Container NestJS API Server (Port 3001), tích hợp Prisma Engine, Health Check `GET /health`, Structured Logger.
  - `brewlite_postgres`: Container PostgreSQL 15 Alpine (Port 5432 nội bộ, **không public cổng ra Internet**).
  - Persistent Volume `brewlite_pg`: Gắn vào thư mục `/var/lib/postgresql/data`, đảm bảo dữ liệu không bị mất khi restart container.
- **Node CI/CD & Registry:** GitHub Actions Runner (Install -> Lint -> Test -> Build), Registry (Docker Hub / GHCR) lưu trữ các Docker image gắn tag Git Commit SHA.
- **Ranh giới môi trường:** Tách biệt rõ ràng ranh giới giữa Local Development, CI Runner và Production Server.

---

# 6. TASK 4 – TRIỂN KHAI SPRINT 1

### 6.1. Task 4.1 – Thiết lập Repository & Quy chuẩn Phát triển
- **Cấu trúc Monorepo:** Gồm `frontend/`, `backend/`, `docs/`, `docker-compose.yml`, `.env.example`, `package.json`.
- **Chiến lược nhánh (Branching Strategy):**
  - `main`: Nhánh production ổn định, chỉ nhận merge từ Pull Request đã vượt qua CI.
  - `develop`: Nhánh tích hợp cho từng Sprint.
  - `feature/*`, `fix/*`, `docs/*`: Nhánh làm việc riêng của từng thành viên.
- **Quy ước Commit (Conventional Commits):** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- **Definition of Done (DoD):**
  1. Mã nguồn viết bằng TypeScript chặt chẽ, không có lỗi type hoặc warning ESLint.
  2. Bắt buộc có Unit Test hoặc Integration Test tương ứng.
  3. Đã chạy kiểm thử cục bộ và vượt qua toàn bộ test suite.
  4. Pull Request được tạo trên GitHub, có mô tả chi tiết và được kiểm tra chéo bởi thành viên cùng cặp.
  5. Pipeline CI tự động chạy thành công 100% (Install -> Lint -> Test -> Build).

### 6.2. Task 4.2 – Quản lý Tài liệu trong `docs/`
- Toàn bộ tài liệu từ Task 1 đến Task 3 được đưa vào kiểm soát phiên bản trong Git:
  - `docs/requirements/context-and-scope.md` (Task 1.1)
  - `docs/requirements/srs.md` (Task 1.2)
  - `docs/requirements/use-case-checkout.md` (Task 1.3)
  - `docs/diagrams/*.puml` (Task 2)
  - `docs/architecture/adr/` (Task 3.1)
  - `docs/traceability-matrix.md` (Task 3 & 5)
- Cam kết không commit các file bí mật (`.env`, private keys) vào repository.

### 6.3. Task 4.3 – MVP Sprint 1 (Menu Chạy được)
- **Backend API:**
  - `GET /api/products`: Trả về danh sách 10 sản phẩm đồ uống truyền thống Việt Nam kèm giá gốc, ảnh và trạng thái tồn kho.
  - `GET /api/products/:id`: Trả về chi tiết sản phẩm kèm danh sách các lựa chọn size (S/M/L) và các topping khả dụng.
- **Dữ liệu mẫu (Database Seed):** Tập lệnh `backend/prisma/seed.ts` nạp sẵn 10 đồ uống: Cà phê đen đá (25k), Cà phê sữa đá (29k), Bạc xỉu (29k), Cà phê muối (35k), Cà phê trứng (39k), Cà phê dừa (35k), Trà sen vàng (39k), Trà đào cam sả (35k), Trà vải hoa hồng (35k), Cacao đá đặc biệt (32k).
- **Frontend Menu Mobile-First:** Màn hình Menu Next.js (`frontend/src/app/page.tsx`), hiển thị component `ProductCard`, hỗ trợ tìm kiếm tức thì theo từ khóa, xử lý trọn vẹn 4 trạng thái giao diện:
  1. `Loading`: Skeleton loader hiển thị trong lúc chờ API.
  2. `Empty`: Thông báo thân thiện khi không tìm thấy món theo từ khóa tìm kiếm.
  3. `Error`: Thông báo lỗi rõ ràng khi máy chủ mất kết nối.
  4. `Retry`: Nút bấm "Thử lại" giúp người dùng tải lại dữ liệu mà không cần F5 trình duyệt.
- **Kiểm thử Sprint 1:** Test suite `products.http.spec.ts`, `products.service.spec.ts` và kiểm thử UI `api-menu.spec.ts`.

### 6.4. Task 4.4 – Continuous Integration (CI Workflow)
- **Cấu hình GitHub Actions (`.github/workflows/ci.yml`):** Tự động kích hoạt khi có Pull Request trỏ vào nhánh `main` hoặc `develop`.
- **Chuỗi thực thi bắt buộc:**
  $$\text{1. Checkout Code} \longrightarrow \text{2. Setup Node.js v20} \longrightarrow \text{3. Install Dependencies} \longrightarrow \text{4. Run ESLint} \longrightarrow \text{5. Run Unit Tests} \longrightarrow \text{6. Next.js & NestJS Build}$$
- **Quy tắc chặn lỗi (Quality Gate):** Tuyệt đối không cho phép merge PR nếu bất kỳ bước nào trong chuỗi bị thất bại (Exit code != 0).
- **Minh chứng chạy:** Lưu giữ nhật ký (Logs) và ảnh chụp của 1 lần CI chạy thành công hoàn toàn và 1 lần CI phát hiện lỗi (ví dụ: lỗi cú pháp lint hoặc fail unit test) để chứng minh tính hiệu quả của pipeline.

---

# 7. TASK 5 – TRIỂN KHAI SPRINT 2, CI/CD VÀ DELIVERY

### 7.1. Task 5.1 – Hoàn thiện MVP Toàn diện
- **Chi tiết & Tùy chọn món:** Màn hình `/products/[id]` cho phép chọn 3 Size (S +0đ, M +6.000đ, L +10.000đ), chọn Topping (Thạch cà phê +6k, Kem sữa +8k, Hạt sen +10k), chọn mức đá (0%, 50%, 100%), độ ngọt (0%, 50%, 100%), ghi chú riêng cho Barista.
- **Giỏ hàng (`/cart`):** Thêm/sửa số lượng/xóa món; cơ chế `configKey` tự động gộp các món có cùng cấu hình tùy chọn; tổng tiền tính lại tự động tại server-side để chống gian lận giá.
- **Xác thực an toàn (Auth):** Đăng ký/Đăng nhập người dùng; cấp JWT HttpOnly Cookie `brewlite_session`; bảo vệ chống tấn công CSRF; cơ chế `sessionVersion` trong database giúp hủy bỏ phiên đăng nhập trên mọi thiết bị khi logout.
- **Tạo đơn & Giữ tồn kho:** Gọi `POST /orders`, kiểm tra tồn kho tại server, khóa hàng và trừ giữ kho (`inventoryHeld = true`), lưu snapshot giá vào `OrderItem`, tạo đơn trạng thái `PENDING`.
- **Thanh toán Ví/Thẻ mô phỏng:** Gọi `POST /payments`, truyền `idempotencyKey: UUID` chống gửi lặp; xử lý các nhánh kết quả `PAID`, `PAYMENT_FAILED` (tự động hoàn trả tồn kho), và `UNKNOWN`.
- **Lịch sử & Theo dõi đơn:** Trang `/orders` và `/orders/[id]` hiển thị mã đơn, thời gian, trạng thái, chi tiết từng món và điểm loyalty tích lũy; áp dụng phân quyền nghiêm ngặt: khách chỉ xem được đơn của chính mình.
- **Giao diện Quầy Barista (KDS):** Màn hình `/barista/dashboard` hiển thị hàng đợi đơn `PAID` theo thứ tự thời gian; các nút thao tác nhanh: "Nhận pha chế" (`PREPARING`), "Món sẵn sàng" (`READY`), "Giao thành công" (`COMPLETED` kèm mốc thời gian `completedAt`); hỗ trợ nút "Hủy đơn" bắt buộc nhập lý do (1-300 ký tự) và tự động hoàn trả kho.

### 7.2. Task 5.2 – Tích hợp và Kiểm thử Toàn diện
- **Kiểm thử Đơn vị & Tích hợp Backend:** Đạt **272/272 tests PASS (25 test suites)** chạy trực tiếp trên cơ sở dữ liệu PostgreSQL 15 thật. Bao gồm:
  - `orders-create.postgres.spec.ts`: Kiểm thử concurrency mô phỏng 2 khách hàng cùng đặt mua sản phẩm cuối cùng tại cùng một mili-giây (chỉ 1 người thành công, người kia nhận 409 Conflict, tồn kho không bao giờ âm).
  - `payment-consistency.postgres.spec.ts`: Kiểm thử chống gửi lặp (gửi lại cùng idempotency key sẽ nhận replay kết quả, không trừ tiền lặp và không cộng điểm lặp).
  - `order-state-machine.spec.ts`: Kiểm thử ma trận 49 cặp chuyển trạng thái đơn (chỉ 9 cạnh hợp lệ được chấp nhận, 40 chuyển đổi sai bị từ chối).
  - `auth.rbac.spec.ts`: Kiểm thử phân quyền Role Guard (Customer không thể truy cập API của Staff Barista).
- **Kiểm thử Giao diện End-to-End (E2E Playwright):** Chạy kiểm thử tự động kịch bản thực tế: Khách hàng duyệt Menu -> Tùy chỉnh món -> Đặt đơn -> Thanh toán thành công -> Barista mở KDS nhận đơn và hoàn tất món. Kiểm thử đạt 100% PASS trên **cả 3 kích thước màn hình: 1440px (Desktop), 768px (Tablet), 390px (Mobile)**.
- **Kiểm tra Sức khỏe Hệ thống (Health Check):** Endpoint `GET /health` trả về HTTP 200 `{ status: "ok", timestamp, database: "connected" }`.
- **Tái tạo Môi trường Sạch:** Khởi chạy toàn bộ hệ thống bằng 1 lệnh duy nhất:
  ```bash
  docker compose down -v
  docker compose up --build -d
  ```

### 7.3. Task 5.3 – Continuous Delivery (CD Workflow)
- **Cấu hình GitHub Actions CD (`.github/workflows/cd.yml`):** Tự động kích hoạt khi có commit merge vào nhánh `main` hoặc khi tạo Git Release Tag (ví dụ: `v1.0.0`).
- **Chuỗi triển khai tự động:**
  $$\text{1. Quality Gate (Lint \& Tests PASS)} \longrightarrow \text{2. Build Docker Images} \longrightarrow \text{3. Tag Image (Commit SHA \& SemVer)} \longrightarrow \text{4. Push Docker Hub / GHCR} \longrightarrow \text{5. Deploy to Production Host} \longrightarrow \text{6. Run Safe Database Migration} \longrightarrow \text{7. Run Automated Smoke Test (GET /health)}$$
- **Cơ chế Rollback:** Nếu bài kiểm thử khói (Smoke Test) tại `GET /health` thất bại sau khi triển khai, pipeline tự động dừng và rollback container về image của phiên bản ổn định trước đó.

### 7.4. Task 5.4 – Triển khai Thực tế và Bàn giao
- **URL Triển khai Thực tế:**
  - URL Giao diện Web (HTTPS): `https://brewlite.example.com` (hoặc link Render/Railway/Fly.io/Vercel của nhóm).
  - URL Backend API & Health Check: `https://api.brewlite.example.com/api/health`.
- **Bảo mật Hạ tầng:** Database PostgreSQL được cô lập trong mạng nội bộ Docker, tuyệt đối không mở cổng trực tiếp ra Internet. Toàn bộ secrets được lưu trong biến môi trường máy chủ.
- **Tài liệu Bàn giao:**
  - File `README.md` hướng dẫn đầy đủ: Khởi chạy local, chạy test, build container, deploy production và quy trình rollback.
  - Release Tag `v1.0.0` kèm Release Notes tóm tắt các tính năng của Sprint 1 & Sprint 2.
  - Video Clip Demo: Quay lại toàn bộ luồng nghiệp vụ end-to-end trên thiết bị thực tế.
  - Biên bản Họp Sprint Review & Sprint Retrospective đúc kết kinh nghiệm của nhóm.

---

# 8. MA TRẬN TRUY VẾT (TRACEABILITY MATRIX)

Ma trận đối chiếu xuyên suốt 100% yêu cầu từ Đề bài sang Mã nguồn và Kiểm thử:

| Mã FR | User Story | Mô hình / Sơ đồ thiết kế | Mã nguồn / API thực tế | Bộ kiểm thử tự động (Test Suites) |
| :---: | :---: | :--- | :--- | :--- |
| **FR-01** | **US-01, US-02** | • Use-case tổng quát (`use-case-system.puml`)<br>• Activity Diagram (`activity-checkout.puml`) | • `ProductsController`, `ProductsService`<br>• `GET /api/products`, `GET /api/products/:id`<br>• UI: `app/page.tsx`, `components/ui.tsx` | • `products.http.spec.ts`<br>• `products.service.spec.ts`<br>• Playwright: `api-menu.spec.ts` |
| **FR-02** | **US-03, US-04** | • Activity Diagram (`activity-checkout.puml`)<br>• Class Diagram (`class-domain.puml`) | • `CartController`, `CartService`, `cart-pricing.ts`<br>• `GET/POST/PATCH/DELETE /api/cart`...<br>• UI: `app/products/[id]`, `app/cart`, `stores/cart.ts` | • `cart-pricing.spec.ts`<br>• `cart.http.spec.ts`<br>• `product-detail.service.spec.ts`<br>• `services/api.test.ts` |
| **FR-03** | **US-05** | • Sequence Diagram (`sequence-checkout.puml`)<br>• Class Diagram (`class-domain.puml`) | • `AuthController`, `AuthService`, `JwtAuthGuard`<br>• `POST /api/auth/register`, `login`, `logout`<br>• UI: `app/login`, `app/register`, `auth-provider.tsx` | • `auth.controller.spec.ts`<br>• `auth.rbac.spec.ts`<br>• `csrf.middleware.spec.ts` |
| **FR-04** | **US-06** | • Sequence Diagram (`sequence-checkout.puml`)<br>• Activity Diagram (`activity-checkout.puml`) | • `OrdersController`, `OrdersService`, `InventoryService`<br>• `POST /api/orders`<br>• UI: `app/checkout/page.tsx`, `order-summary.tsx` | • `orders-create.postgres.spec.ts`<br>• `orders.postgres.spec.ts`<br>• `orders.service.spec.ts` |
| **FR-05** | **US-07, US-09** | • Sequence Diagram (`sequence-checkout.puml`)<br>• ADR-003 (`003-mock-payment-idempotency.md`) | • `PaymentsController`, `PaymentsService`, `MockPaymentGateway`<br>• `POST /api/payments`<br>• UI: `services/payment-intent.ts`, `/payment/[id]/...` | • `payment-consistency.postgres.spec.ts`<br>• `payment-status.postgres.spec.ts`<br>• `mock-payment.gateway.spec.ts` |
| **FR-06** | **US-08** | • Use-case tổng quát (`use-case-system.puml`)<br>• Class Diagram (`class-domain.puml`) | • `OrdersController`<br>• `GET /api/orders/me`, `GET /api/orders/:id`<br>• UI: `app/orders/page.tsx`, `app/orders/[id]/page.tsx` | • `orders.postgres.spec.ts`<br>• Playwright: `orders-api.spec.ts` |
| **FR-07** | **US-10, US-11** | • Sequence Diagram (`sequence-checkout.puml`)<br>• ADR-002 (`002-nestjs-prisma-postgresql.md`) | • `order-state-machine.ts`, `inventory.service.ts`<br>• Prisma Interactive Transaction, `SELECT FOR UPDATE` | • `order-state-machine.spec.ts`<br>• `inventory.service.spec.ts`<br>• Concurrency test trong `orders-create` |
| **FR-08** | **US-12, US-13** | • Class Diagram (`class-domain.puml`) | • `order-discount.ts`, logic Loyalty trong `PaymentsService`<br>• UI: Khung Voucher tại Checkout, điểm tại Profile | • `orders.service.spec.ts`<br>• `payment-consistency.postgres.spec.ts` |
| **FR-09** | **US-14, US-15** | • Sơ đồ Use-case Barista KDS<br>• Activity Diagram (`activity-checkout.puml`) | • `StaffOrdersController`, `BaristaController`<br>• `GET /api/staff/orders`, `PATCH status`, `cancel`<br>• UI: `app/barista/dashboard`, `barista-board.tsx` | • `staff-orders.postgres.spec.ts`<br>• `auth.rbac.spec.ts`<br>• Playwright: `e2e/flow.spec.ts` |

---

# 9. CẤU TRÚC REPOSITORY (REPOSITORY STRUCTURE)

Cấu trúc monorepo của BrewLite tương thích hoàn toàn với mẫu quy định của đề bài:

```text
brewlite/
├── frontend/                     # [Tương ứng apps/web trong đề] Next.js mobile-first/PWA
│   ├── src/app/                  # App Router: /, /products/[id], /cart, /checkout, /login, /orders, /barista
│   ├── src/components/           # Reusable UI components: shell, ui, barista-board, order-summary
│   ├── src/stores/               # Zustand stores: cart.ts
│   ├── src/services/             # Service adapters: api.ts, auth.ts, contracts.ts, mock.ts (chỉ test)
│   ├── e2e/                      # Playwright E2E test suites (api-menu, flow, orders-api)
│   └── package.json
├── backend/                      # [Tương ứng apps/api trong đề] NestJS REST API
│   ├── src/
│   │   ├── auth/                 # Module Auth: JWT, bcrypt, RBAC guards, session_version
│   │   ├── products/             # Module Products: catalog, size, topping
│   │   ├── cart/                 # Module Cart: tính giá server-side, check tồn kho
│   │   ├── orders/               # Module Orders & Inventory: state machine, transaction, Staff KDS
│   │   ├── payments/             # Module Payments: mock gateway, idempotency key, journaling
│   │   └── inventory/            # Module Inventory: giữ kho khi đặt, hoàn kho khi hủy
│   ├── prisma/
│   │   ├── schema.prisma         # Single source of truth cho database schema
│   │   ├── migrations/           # 11 bản migration SQL có phiên bản rõ ràng
│   │   └── seed.ts               # Seed data 10 sản phẩm đồ uống truyền thống
│   └── package.json
├── docs/                         # Toàn bộ tài liệu kỹ thuật có kiểm soát phiên bản
│   ├── requirements/             # Task 1: context-and-scope.md, srs.md, use-case-checkout.md
│   ├── diagrams/                 # Task 2: file nguồn .puml và hình ảnh .svg/.png
│   │   ├── use-case-system.puml
│   │   ├── activity-checkout.puml
│   │   ├── sequence-checkout.puml
│   │   ├── class-domain.puml
│   │   └── deployment.puml
│   ├── architecture/             # Task 3: C4 diagrams, adr/ (ADR-001 đến ADR-004)
│   │   └── adr/
│   ├── assignment2/              # Hồ sơ phân công và bàn giao Task 1-5
│   └── traceability-matrix.md    # Ma trận truy vết bắt buộc FR -> US -> Sơ đồ -> Code -> Test
├── .github/
│   └── workflows/                # Pipeline tự động hóa CI/CD
│       ├── ci.yml                # CI: Install -> Lint -> Unit Test -> Build (Pull Request gate)
│       └── cd.yml                # CD: Docker build -> Push registry -> Deploy -> Smoke test
├── docker-compose.yml            # Khởi chạy fullstack: web (3000), api (3001), postgres (5434 host / 5432)
├── .env.example                  # Mẫu biến môi trường an toàn (không chứa secret thật)
└── README.md                     # Hướng dẫn khởi chạy, test, build, deploy và rollback
```

---

# 10. PHÂN CÔNG CÔNG VIỆC THEO THÀNH VIÊN VÀ TASK

Hệ thống phân chia trách nhiệm rành mạch cho **6 thành viên**, đảm bảo cả 6 bạn đều tham gia xuyên suốt từ Task 1 đến Task 5 và có đóng góp mã nguồn/test cụ thể trong cả 2 Sprint:

### 10.1. Bảng Phân công Chi tiết 6 Thành viên

| STT | Thành viên | Trách nhiệm Task 1 – 3 (Tài liệu & Thiết kế) | Trách nhiệm Task 4 (Sprint 1 MVP Menu & CI) | Trách nhiệm Task 5 (Sprint 2 MVP Hoàn chỉnh, CD & Delivery) | Người phối hợp review chéo |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Phạm Gia Khôi** | • Chủ trì Task 1.1: Bối cảnh, stakeholder, phạm vi (`context-and-scope.md`)<br>• Task 2.1: Activity menu & giỏ hàng<br>• Task 3.1: Thiết kế Frontend Next.js mobile-first, ADR-001 | Code UI Menu mobile-first và `ProductCard`, component tests | Code UI chi tiết món, tùy chọn size/topping, tính giá động, thêm giỏ hàng, validate tùy chọn | **Võ Minh Tri** (Cặp 1) |
| **2** | **Võ Minh Tri** | • Task 1.2: Đặc tả FR menu, giỏ hàng, checkout; ghép SRS toàn hệ thống<br>• Task 2.1: Activity đặt đơn & thanh toán, swimlanes<br>• Task 3.1: Kiến trúc phân lớp & C4 tổng thể | Code khung ứng dụng Next.js, layout shell, routing, API adapter gọi backend | Code UI Giỏ hàng, tăng/giảm/xóa, tổng tiền, checkout, thanh toán mô phỏng Ví/Thẻ | **Phạm Gia Khôi** (Cặp 1) |
| **3** | **Nguyễn Văn Đông** | • Task 1.2: Đặc tả Auth JWT, NFR bảo mật, AC<br>• Task 2.2: Sequence tạo đơn: Customer -> UI -> API -> DB (JWT, validate, transaction, trừ kho)<br>• Task 3.1: Thiết kế module NestJS, ADR-002 | Code kết nối PostgreSQL, 11 Prisma migrations, seed 10 sản phẩm, API `GET /products`, unit test | Code API Auth (đăng ký/đăng nhập, JWT cookie), API tạo đơn (`POST /orders`), transaction trừ kho, integration test | **Lê Quang Điệp** (Cặp 2) |
| **4** | **Lê Quang Điệp** | • Task 1.3: Chủ trì đặc tả Use-case trọng tâm Đặt & thanh toán (`use-case-checkout.md`)<br>• Task 2.2: Sequence thanh toán, alt block thành công/thất bại, idempotency retry<br>• Task 3.1: Thiết kế DB schema, transaction đơn-kho, ADR-003 | Code API `GET /products/:id` (chi tiết món, size, topping, validate UUID, 404 handler) & test tương ứng | Code API thanh toán Ví/Thẻ mô phỏng (`POST /payments`), idempotency key replay, API lịch sử đơn (`GET /orders/me`), test transaction/concurrency | **Nguyễn Văn Đông** (Cặp 2) |
| **5** | **Trần Thế Duy** | • Task 1.2–1.3: Vẽ Sơ đồ Use-case tổng quát & Use-case checkout; rà soát AC<br>• Task 2.3: Chủ trì Class Diagram domain (7 lớp)<br>• Task 3.1: Rà soát trade-offs, test list theo AC | Code component Loading, Empty, Error, Retry; tích hợp menu; component tests | Code UI Login/Register, UI lịch sử đơn & theo dõi trạng thái đơn, kịch bản E2E Playwright Menu -> Checkout | **Nguyễn Tuấn Kiệt** (Cặp 3) |
| **6** | **Nguyễn Tuấn Kiệt** | • Task 1.2: Đặc tả NFR hiệu năng/khả dụng/triển khai, khởi tạo repo & commit conventions<br>• Task 2: Chuẩn hóa xuất PlantUML `.svg`/`.png`, khởi tạo `traceability-matrix.md`<br>• Task 3.2: Chủ trì Deployment Diagram production, ADR-004 | Code bootstrap NestJS, API `GET /health` & test; repo structure, README, `.env.example`, DoD, workflow GitHub Actions CI | Code API cập nhật trạng thái đơn Barista KDS (`PATCH status`, `cancel`), phân quyền RBAC, Docker Compose fullstack, workflow GitHub Actions CD | **Trần Thế Duy** (Cặp 3) |

---

### 10.6. Tiến độ Bàn giao theo Mẫu Phân công (Milestones)

| STT | Mốc Thời gian | Nội dung Công việc & Tạo phẩm Bàn giao | Người Chốt / Nghiệm thu |
| :---: | :---: | :--- | :--- |
| **1** | **23/10 – 25/10/2026** | **Task 1:** Phân tích phạm vi, stakeholder, hoàn thiện 15 User Stories, SRS rút gọn (FR-01..09, NFR-01..06) và đặc tả use-case trọng tâm UC-CHK; vẽ sơ đồ use-case. | Toàn nhóm (Khôi chốt Task 1.1, Tri chốt Task 1.2, Điệp chốt Task 1.3) |
| **2** | **26/10 – 29/10/2026** | **Task 2:** Hoàn thiện bộ 3 sơ đồ UML: Activity Diagram (luồng end-to-end), Sequence Diagram (đặt/thanh toán), Class Diagram (7 lớp domain); lưu file nguồn `.puml` và xuất hình. | Duy & Kiệt chuẩn hóa; toàn nhóm đối chiếu chéo với User Story. |
| **3** | **30/10 – 01/11/2026** | **Task 3:** Chốt kiến trúc phân lớp & C4, hoàn thiện 4 bản ADR (001 đến 004), thống nhất API contracts và hoàn thiện Deployment Diagram production. | Tri & Duy chốt ADR; Kiệt chốt Deployment Diagram. |
| **4** | **02/11 – 08/11/2026** | **Task 4:** Tạo repo monorepo, tài liệu docs/, hoàn thành MVP Menu chạy được (`GET /products`, `GET /products/:id`, UI Menu mobile-first, seed mẫu), thiết lập CI workflow chặn merge khi lỗi. | Đông & Tri bàn giao API/UI; Kiệt & Khôi nghiệm thu CI. |
| **5** | **09/11 – 20/11/2026** | **Task 5:** Hoàn thiện MVP toàn diện, tích hợp thanh toán mô phỏng idempotency, KDS Barista, 272/272 tests tự động, Playwright E2E, thiết lập CD pipeline, deploy live HTTPS, quay demo video, viết Sprint Review/Retrospective. | Điệp & Duy chốt luồng E2E; Kiệt chốt CD & Deploy; Khôi chốt hồ sơ nộp bài. |

---

### 10.7. Checklist Nộp bài Hoàn chỉnh (100% Đạt Tiêu chuẩn Đề bài)
- [x] **Link Repository & Quyền truy cập:** Đã thêm quyền truy cập cho Giảng viên; lịch sử Git commit/PR thể hiện rõ ràng thứ tự 5 Task tuần tự.
- [x] **Tài liệu Yêu cầu (SRS / User Story):** Đầy đủ bối cảnh, 6 stakeholders, phạm vi MVP/mở rộng, 15 User Stories, 9 FRs, 6 NFRs, đặc tả use-case trọng tâm UC-CHK; ma trận truy vết `traceability-matrix.md` được cập nhật 100%.
- [x] **Mô hình hóa Hệ thống (UML Diagrams):** Đầy đủ Activity, Sequence, Class và Deployment Diagram có file nguồn `.puml` cùng bản xuất ảnh rõ nét trong `docs/diagrams/`.
- [x] **Mã nguồn Ứng dụng:** Mã nguồn Frontend Next.js mobile-first, Backend NestJS modular, 11 Prisma SQL migrations, seed 10 sản phẩm chuẩn, `docker-compose.yml` khởi chạy 1 lệnh và `README.md` chi tiết.
- [x] **Kiểm thử & CI/CD Pipeline:** Đạt 272/272 Unit/Integration tests, 3 Playwright E2E suites; pipeline CI chặn lỗi khi mở PR; pipeline CD tự động đóng gói Docker image, push registry và deploy.
- [x] **Triển khai Live & Nghiệm thu:** Có URL Frontend chạy HTTPS thực tế, URL API và endpoint `GET /health`, database được bảo vệ trong mạng nội bộ, release tag `v1.0.0`, video demo luồng mua hàng và biên bản Sprint Retrospective.

