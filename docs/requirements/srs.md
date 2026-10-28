# Task 1.2: Tài liệu Đặc tả Yêu cầu Phần mềm Rút gọn (SRS - BrewLite)

- **Đồ án:** BrewLite (Artisanal Vietnamese Coffee Ordering & Cashless Payment)
- **Môn học:** Công nghệ Phần mềm — Đại học Sài Gòn
- **Phụ trách chính:** Võ Minh Tri, Nguyễn Văn Đông, Nguyễn Tuấn Kiệt (phối hợp toàn nhóm)

---

## 1. Danh sách User Stories & Phân loại MoSCoW

| Mã US | Mức độ | Vai trò & Yêu cầu User Story | Ánh xạ Task | Tiêu chí chấp nhận chính (Acceptance Criteria) |
| :---: | :---: | :--- | :---: | :--- |
| **US-01** | **Must** | Là khách hàng, tôi muốn xem menu gồm tên, giá, ảnh và trạng thái món để chọn đồ uống. | Task 1, 4 | Hiển thị tối thiểu 10 sản phẩm; tải ảnh đúng định dạng; hiển thị rõ trạng thái còn hàng/hết hàng; giao diện chuẩn mobile-first. |
| **US-02** | **Should** | Là khách hàng, tôi muốn tìm món theo tên/từ khóa để nhanh chóng chọn được sản phẩm. | Task 1, 4 | Ô tìm kiếm lọc danh sách tức thì; không phân biệt chữ hoa/thường; hiển thị thông báo rỗng khi không tìm thấy kết quả. |
| **US-03** | **Must** | Là khách hàng, tôi muốn xem chi tiết và chọn size/topping để tùy chỉnh đồ uống theo sở thích. | Task 1, 5 | Màn hình chi tiết có 3 size (S/M/L) với phụ thu tương ứng; danh sách topping hiển thị giá cộng thêm; cho phép chọn mức đá và đường. |
| **US-04** | **Must** | Là khách hàng, tôi muốn thêm/sửa/xóa món trong giỏ và thấy tổng tiền cập nhật đúng. | Task 1, 5 | Thay đổi số lượng món; xóa từng món hoặc dọn sạch giỏ; tổng tiền tự động tính lại theo công thức server-side; giỏ lưu theo phiên/user. |
| **US-05** | **Must** | Là khách hàng, tôi muốn đăng ký/đăng nhập để tạo đơn bằng tài khoản của mình. | Task 1, 5 | Đăng ký bằng Email/Password/Họ tên; mật khẩu được băm bcrypt; cấp JWT HttpOnly cookie an toàn; logout vô hiệu hóa session. |
| **US-06** | **Must** | Là khách hàng đã đăng nhập, tôi muốn tạo đơn từ giỏ để hệ thống ghi nhận món cần đặt. | Task 1, 5 | Gọi `POST /orders`; kiểm tra tồn kho; trừ giữ kho an toàn; lưu snapshot giá không thể thay đổi; tạo đơn ở trạng thái `PENDING`. |
| **US-07** | **Must** | Là khách hàng, tôi muốn thanh toán bằng Ví/Thẻ mô phỏng để hoàn tất đơn không tiền mặt. | Task 1, 5 | Chọn Ví điện tử hoặc Thẻ ngân hàng; hệ thống gửi yêu cầu thanh toán mô phỏng; nếu thành công chuyển `PAID`, thất bại chuyển `PAYMENT_FAILED`. |
| **US-08** | **Must** | Là khách hàng, tôi muốn nhận xác nhận, xem lịch sử và theo dõi trạng thái đơn. | Task 1, 5 | Trang xác nhận hiển thị mã đơn, tổng tiền, chi tiết món; trang Lịch sử đơn chỉ cho phép xem đơn của chính tài khoản đăng nhập. |
| **US-09** | **Must** | Là hệ thống, tôi muốn chống xử lý thanh toán lặp để không ghi nhận giao dịch hai lần. | Task 1, 5 | Client gửi `idempotencyKey: UUID`; server lưu vết và replay kết quả nếu trùng key; không trừ tiền kép và không gọi cổng lặp lại. |
| **US-10** | **Must** | Là hệ thống, tôi muốn kiểm tra tồn kho an toàn khi nhiều khách đặt đồng thời. | Task 1, 5 | Áp dụng Database Transaction và khóa dòng `SELECT FOR UPDATE`; ngăn chặn tuyệt đối tình trạng tồn kho bị âm khi tranh mua món cuối. |
| **US-11** | **Must** | Là hệ thống, tôi muốn chỉ cho phép chuyển trạng thái đơn theo vòng đời hợp lệ. | Task 1, 5 | Tuân thủ máy trạng thái hữu hạn: `PENDING -> PAID -> PREPARING -> READY -> COMPLETED`; từ chối các bước nhảy cóc hoặc đảo ngược trạng thái. |
| **US-12** | **Should** | Là khách hàng, tôi muốn áp dụng mã giảm giá hợp lệ để giảm số tiền thanh toán. | Task 1, 5 | Nhập mã khuyến mãi hợp lệ; hệ thống khấu trừ trực tiếp vào tổng tiền trước khi tạo đơn và thanh toán. |
| **US-13** | **Could** | Là khách hàng, tôi muốn được cộng điểm sau thanh toán thành công để tích lũy quyền lợi. | Task 1, 5 | Cộng tự động điểm thưởng loyalty (`floor(total / 10000)`) khi đơn chuyển sang `PAID`; hiển thị điểm tích lũy trên trang cá nhân. |
| **US-14** | **Could (Ext)** | Là Barista, tôi muốn xem và tiếp nhận đơn đã thanh toán để pha chế đúng thứ tự. | Task 1, 5 | Màn hình KDS chỉ cho phép tài khoản có Role `BARISTA` truy cập; hiển thị danh sách đơn `PAID` theo thứ tự FIFO; bấm nhận chuyển `PREPARING`. |
| **US-15** | **Could (Ext)** | Là Barista, tôi muốn cập nhật READY/COMPLETED hoặc hủy đơn hợp lệ để thông báo tiến trình. | Task 1, 5 | Chuyển `READY` khi pha xong, chuyển `COMPLETED` kèm ghi nhận `completedAt` khi giao; hủy đơn bắt buộc nhập lý do (1-300 ký tự) và tự hoàn kho. |

---

## 2. Bảng Yêu cầu Chức năng (Functional Requirements - FR)

| Mã FR | Phân hệ chức năng | Mô tả chi tiết nội dung nghiệp vụ | Mức độ | Ánh xạ Use-case / Code |
| :---: | :--- | :--- | :---: | :--- |
| **FR-01** | Menu & Catalog | Xem danh sách sản phẩm, tìm kiếm không phân biệt hoa thường, xem chi tiết đồ uống kèm tình trạng còn hàng/hết hàng. | Must | US-01, US-02<br>`GET /products`, `GET /products/:id` |
| **FR-02** | Tùy chỉnh & Giỏ hàng | Chọn kích cỡ (S/M/L), thêm topping, chọn mức đá/đường, thêm/sửa/xóa món, tính tổng tiền server-side tự động. | Must | US-03, US-04<br>`/cart`, `CartStore`, `CartModule` |
| **FR-03** | Quản lý Tài khoản | Đăng ký, đăng nhập người dùng, cấp cookie JWT HttpOnly, kiểm tra phân quyền RBAC (`CUSTOMER`, `BARISTA`), hủy phiên an toàn bằng `sessionVersion`. | Must | US-05<br>`POST /auth/register`, `POST /auth/login`, `POST /auth/logout` |
| **FR-04** | Đặt hàng | Xác thực giỏ hàng, kiểm tra tồn kho tại server, tính lại giá snapshot, tạo đơn trạng thái ban đầu `PENDING`. | Must | US-06<br>`POST /orders` |
| **FR-05** | Thanh toán | Xử lý thanh toán mô phỏng Ví điện tử hoặc Thẻ ngân hàng, lưu vết kết quả giao dịch, hỗ trợ retry với Idempotency Key chống ghi nhận kép. | Must | US-07, US-09<br>`POST /payments`, `MockPaymentGateway` |
| **FR-06** | Theo dõi & Lịch sử đơn | Hiển thị màn hình xác nhận đơn hàng, xem danh sách lịch sử đơn của tài khoản, theo dõi tiến trình đơn hàng (chỉ chủ sở hữu mới xem được đơn). | Must | US-08<br>`GET /orders/me`, `GET /orders/:id` |
| **FR-07** | Vòng đời đơn & Tồn kho | Quản lý chuyển trạng thái hợp lệ theo State Machine; khóa dòng và transaction bảo vệ tồn kho không bị âm khi nhiều khách đặt cùng lúc; hoàn kho khi hủy. | Must | US-10, US-11<br>`order-state-machine.ts`, `inventory.service.ts` |
| **FR-08** | Khuyến mãi & Điểm thưởng | Áp dụng mã giảm giá hợp lệ; tự động tích lũy điểm thưởng loyalty sau khi thanh toán thành công (`10.000đ = 1 điểm`). | Should / Could | US-12, US-13<br>`order-discount.ts`, `users.loyalty_points` |
| **FR-09** | Nghiệp vụ Quầy Barista (Mở rộng) | Màn hình hàng đợi KDS cho Barista; tiếp nhận pha chế (`PREPARING`), báo hoàn tất (`READY -> COMPLETED`), hủy đơn có lý do và tự hoàn kho. | Could (Ext) | US-14, US-15<br>`GET /staff/orders`, `PATCH /staff/orders/:id/status`, `PATCH /staff/orders/:id/cancel` |

---

## 3. Bảng Yêu cầu Phi Chức năng (Non-Functional Requirements - NFR)

| Mã NFR | Thuộc tính chất lượng | Yêu cầu kỹ thuật & Tiêu chí đo lường cụ thể | Phương pháp kiểm chứng |
| :---: | :--- | :--- | :--- |
| **NFR-01** | **Hiệu năng (Performance)** | Thời gian phản hồi API menu (`GET /products`) dưới **200ms** ở điều kiện tải thông thường; thời gian xử lý tạo đơn và thanh toán dưới **1.000ms**. | Chạy script benchmark (`products.benchmark.mjs`) và kiểm thử tải với Autocannon / Artillery. |
| **NFR-02** | **Bảo mật (Security)** | Mật khẩu tài khoản bắt buộc băm bằng thuật toán `bcrypt` (salt rounds >= 10); Token JWT đóng gói trong Cookie `HttpOnly, SameSite=Lax`; kiểm tra quyền hạn (Role Guard) ở backend; không để lộ Secrets trong mã nguồn Git hay logs hệ thống. | Rà soát mã nguồn tĩnh (Static Analysis); kiểm tra `git diff`; test suite `auth.rbac.spec.ts` và `csrf.middleware.spec.ts`. |
| **NFR-03** | **Tính sẵn sàng (Availability)** | Cung cấp endpoint kiểm tra sức khỏe `GET /health`; hệ thống tự phục hồi khi có lỗi; giao diện hiển thị trạng thái lỗi rõ ràng kèm nút thử lại (Retry) khi mất kết nối mạng. | Kiểm thử ngắt kết nối database; gọi định kỳ `GET /health`; kiểm tra 4 trạng thái giao diện UI (`loading`, `empty`, `error`, `retry`). |
| **NFR-04** | **Tính toàn vẹn (Data Integrity)** | Áp dụng Database Transaction bảo vệ luồng tạo đơn và thanh toán; cơ chế Idempotency chống ghi nhận giao dịch kép; cơ chế khóa lạc quan (Optimistic Locking) chống ghi đè trạng thái đơn. | Chạy bộ test suite đồng thời: `orders-create.postgres.spec.ts`, `payment-consistency.postgres.spec.ts`. |
| **NFR-05** | **Khả năng triển khai (Deployability)** | Toàn bộ hệ thống Frontend, Backend, Database khởi chạy nhất quán thông qua lệnh `docker compose up --build`; cấu hình môi trường tách biệt hoàn toàn thông qua file `.env`. | Triển khai thực tế trên môi trường Docker cục bộ và máy chủ đám mây (Cloud Host). |
| **NFR-06** | **Khả năng bảo trì (Maintainability)** | Phân tách module rõ ràng theo kiến trúc Modular của NestJS và App Router của Next.js; toàn bộ mã nguồn sử dụng TypeScript chặt chẽ; tài liệu kỹ thuật và API Contract được cập nhật đồng bộ. | Bộ công cụ ESLint, Prettier; độ bao phủ kiểm thử đạt 272/272 tests PASS. |

