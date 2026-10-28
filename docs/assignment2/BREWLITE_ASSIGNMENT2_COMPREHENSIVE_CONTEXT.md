# HỒ SƠ DỮ LIỆU TỔNG HỢP TOÀN DIỆN ĐỒ ÁN BREWLITE (ASSIGNMENT 2)
> **Tài liệu tham chiếu chuẩn cho AI & Thành viên dự án**  
> *Dành cho việc nạp ngữ cảnh vào AI (ChatGPT, Claude, Gemini,...) để đồng hành giải quyết trọn vẹn Assignment 2 môn Công nghệ Phần mềm.*  
> **Phiên bản:** 1.0 | **Ngày lập:** 24/10/2026 | **Cơ sở đào tạo:** Trường Đại học Sài Gòn - Khoa Công nghệ Thông tin

---

## MỤC LỤC
1. [Tổng quan Đề tài & Yêu cầu Assignment 2](#1-tổng-quan-đề-tài--yêu-cầu-assignment-2)
2. [Quy tắc thực hiện & Tiêu chuẩn nghiệm thu cốt lõi](#2-quy-tắc-thực-hiện--tiêu-chuẩn-nghiệm-thu-cốt-lõi)
3. [Phân công trách nhiệm 6 thành viên & Lịch trình tuần tự](#3-phân-công-trách-nhiệm-6-thành-viên--lịch-trình-tuần-tự)
4. [Chi tiết nội dung 5 Task theo đề bài](#4-chi-tiết-nội-dung-5-task-theo-đề-bài)
5. [Cấu trúc Repository & Bản đồ mã nguồn](#5-cấu-trúc-repository--bản-đồ-mã-nguồn)
6. [Mô hình dữ liệu (Prisma Schema, Enums, Migrations, Seed)](#6-mô-hình-dữ-liệu-prisma-schema-enums-migrations-seed)
7. [Hợp đồng API & Luồng nghiệp vụ cốt lõi](#7-hợp-đồng-api--luồng-nghiệp-vụ-cốt-lõi)
8. [Đặc tả Use-Case trọng tâm: Đặt & Thanh toán đơn hàng (UC-CHK)](#8-đặc-tả-use-case-trọng-tâm-đặt--thanh-toán-đơn-hàng-uc-chk)
9. [Hiện trạng dự án, Các khoảng trống kỹ thuật & Việc cần làm](#9-hiện-trạng-dự-án-các-khoảng-trống-kỹ-thuật--việc-cần-làm)
10. [Hướng dẫn vận hành & Quy tắc chỉ đạo cho AI](#10-hướng-dẫn-vận-hành--quy-tắc-chỉ-đạo-cho-ai)

---

## 1. TỔNG QUAN ĐỀ TÀI & YÊU CẦU ASSIGNMENT 2

### 1.1. Bối cảnh & Mục tiêu
- **Tên dự án:** BrewLite (Artisanal Vietnamese Coffee Ordering & Cashless Payment).
- **Môn học:** Công nghệ Phần mềm (Software Engineering) – Học kỳ I, Năm học 2026–2027.
- **Tính chất Assignment 2:** Tiếp tục phát triển dự án BrewLite từ Assignment 1 theo một chuỗi công việc hoàn chỉnh: từ khai thác yêu cầu, mô hình hóa hệ thống, thiết kế kiến trúc, hiện thực qua 2 Sprint, thiết lập pipeline CI/CD tự động và triển khai (deployment) hệ thống lên môi trường production có thể truy cập được qua Internet.
- **Luồng nghiệp vụ tối thiểu bắt buộc:**
  $$\text{Xem menu} \longrightarrow \text{Chọn tùy chọn} \longrightarrow \text{Giỏ hàng} \longrightarrow \text{Đặt đơn} \longrightarrow \text{Thanh toán} \longrightarrow \text{Theo dõi đơn}$$

### 1.2. Công nghệ bắt buộc (Không được thay thế)
1. **Frontend:** `Next.js` (App Router, TypeScript, Tailwind CSS, Zustand, mobile-first / PWA).
2. **Backend:** `NestJS` (TypeScript, Modular Architecture, class-validator, JWT, bcrypt).
3. **Database:** `PostgreSQL` (quản trị schema và migration bằng `Prisma ORM`).
4. **Đóng gói & Ảo hóa:** `Docker` & `Docker Compose`.

---

## 2. QUY TẮC THỰC HIỆN & TIÊU CHUẨN NGHIỆM THU CỐT LÕI

1. **Quy tắc tuần tự bắt buộc (Strict Sequential Rule):**
   - 5 Task lớn phải được hoàn thành đúng thứ tự: Task 1 → Task 2 → Task 3 → Task 4 → Task 5.
   - Task sau chỉ được nghiệm thu khi tất cả tạo phẩm bắt buộc của Task trước đã nằm trên kho mã nguồn Git và có lịch sử commit/PR minh bạch.
   - Không được dùng kết quả Assignment 1 để tự đánh dấu hoàn thành Assignment 2.
2. **Quy định đóng góp code công bằng cho 6 thành viên:**
   - Cả 6 thành viên phải tham gia đầy đủ cả 5 Task.
   - Mỗi thành viên **bắt buộc phải có ít nhất 1 Pull Request (PR) mã nguồn ứng dụng trong Task 4 (Sprint 1)** và **ít nhất 1 PR mã nguồn ứng dụng trong Task 5 (Sprint 2)** kèm unit test tương ứng.
   - Kiểm tra chéo theo 3 cặp cố định:
     - **Cặp 1:** Phạm Gia Khôi – Võ Minh Tri
     - **Cặp 2:** Nguyễn Văn Đông – Lê Quang Điệp
     - **Cặp 3:** Trần Thế Duy – Nguyễn Tuấn Kiệt
3. **Tiêu chuẩn kỹ thuật nghiệm thu:**
   - **Xác thực (Auth):** Luôn là backend thật (cookie `brewlite_session` HttpOnly, SameSite=Lax, JWT chứa `sessionVersion` để vô hiệu hóa tức thì mọi thiết bị khi logout).
   - **Mock Data:** Chỉ nằm cô lập tại `frontend/src/services/mock.ts`. Khi chạy `API mode` tuyệt đối không tự ý fallback về mock.
   - **Responsive & Design System:** Bám sát 9 màn hình thiết kế Stitch (`stitch/*/code.html`, `screen.webp`, `DESIGN.md`), bắt buộc kiểm thử trên 3 viewport: **1440px (Desktop), 768px (Tablet), 390px (Mobile)**.
   - **Truy vết bắt buộc:** Bắt buộc duy trì file `docs/traceability-matrix.md` khớp nối: `Mã FR/NFR → Use-case/User Story → Thiết kế/Sơ đồ → Code/API → Test ID`.
   - **Production:** Phải có URL frontend chạy HTTPS thật, URL backend API & endpoint kiểm tra sức khỏe `GET /health`. Database production tuyệt đối **không mở public trực tiếp**. Không để lộ secrets trong repository hoặc CI logs.

---

## 3. PHÂN CÔNG TRÁCH NHIỆM 6 THÀNH VIÊN & LỊCH TRÌNH TUẦN TỰ

### 3.1. Lịch trình tổng thể (Mốc thời gian năm 2026)
- **Task 1 (Khai thác & đặc tả yêu cầu):** 23/10 – 25/10 (Tuần 7) – Chốt nghiệm thu ngày 25/10.
- **Task 2 (Mô hình hóa hệ thống):** 26/10 – 29/10 (Tuần 8) – Chốt nghiệm thu ngày 29/10.
- **Task 3 (Thiết kế kiến trúc & Deployment):** 30/10 – 01/11 (Tuần 8) – Chốt nghiệm thu ngày 01/11.
- **Task 4 (Sprint 1 - Nền tảng & MVP Menu):** 02/11 – 08/11 (Tuần 9) – Bàn giao API 05/11, ghép mã 06/11, nghiệm thu 08/11.
- **Task 5 (Sprint 2 - Hoàn thiện MVP, CI/CD & Delivery):** 09/11 – 20/11 (Tuần 10–11) – Chốt code 13/11, deploy & E2E 16/11.
- **Nộp bài dự kiến:** **20/11/2026** (Tuần 11).
- **Vòng dự phòng, sửa lỗi, hoàn thiện hồ sơ:** 21/11 – 24/11/2026.
- **Hạn chót đóng hệ thống:** **25/11/2026**.

### 3.2. Bảng phân công chi tiết 6 thành viên

| STT | Thành viên | Vai trò & Trách nhiệm Task 1 – 3 | Trách nhiệm Code Task 4 (Sprint 1) | Trách nhiệm Code Task 5 (Sprint 2) | Hạng mục bàn giao chính |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Phạm Gia Khôi** | • Task 1.1: Bối cảnh, stakeholder, mục tiêu, in/out scope, rủi ro (`context-and-scope.md`)<br>• Task 2.1: Activity menu, chi tiết món, giỏ hàng, hết hàng<br>• Task 3.1: Thiết kế Frontend Next.js mobile-first, chia trang & component | Code giao diện Menu mobile-first và `ProductCard` (tên/ảnh/giá từ API), viết component test | Code màn hình chi tiết món, chọn size/topping, tính giá động, thêm giỏ hàng, validate tùy chọn, xử lý hết hàng | URL Frontend HTTPS, hiển thị mobile-first |
| 2 | **Võ Minh Tri** | • Task 1.2: Đặc tả FR menu, chi tiết món, giỏ, checkout; gán mã FR, MoSCoW, AC; ghép bản SRS<br>• Task 2.1: Activity đặt đơn, thanh toán, swimlane, ghép end-to-end với Khôi<br>• Task 3.1: Ghép mô tả kiến trúc C4 / phân lớp | Code khung ứng dụng Next.js, điều hướng menu/chi tiết, lớp gọi API adapter, ghép component Khôi-Duy | Code giao diện Giỏ hàng, tăng/giảm/xóa, tổng tiền, checkout, thanh toán mô phỏng Ví/Thẻ, xác nhận đơn | Giỏ hàng, checkout, video/demo end-to-end |
| 3 | **Nguyễn Văn Đông** | • Task 1.2: Đặc tả Auth (đăng ký/đăng nhập, JWT), lịch sử đơn, trạng thái đơn, NFR bảo mật, AC<br>• Task 2.2: Sequence tạo đơn: Customer → UI → API → DB (JWT, validate, transaction, trừ kho)<br>• Task 3.1: Thiết kế module NestJS, contract sản phẩm, auth, đặt đơn | Code kết nối PostgreSQL, migration/seed dữ liệu mẫu chạy lại được, API `GET /products`, unit/API test | Code API Auth (đăng ký/đăng nhập, JWT), API tạo đơn, server-side validation giỏ/giá, transaction trừ kho, unit & integration test | Bản SRS hoàn chỉnh, API Auth/Orders, migration & seed |
| 4 | **Lê Quang Điệp** *(Owner)* | • Task 1.3: Đặc tả Use-Case trọng tâm `UC-CHK` (Đặt và thanh toán đơn hàng): actor, luồng, ngoại lệ, link FR<br>• Task 2.2: Sequence nối Payment Service, nhánh alt thành công/thất bại, idempotency, kết quả<br>• Task 3.1: Thiết kế DB schema, migration, transaction đơn-kho, mock payment contract, chống gửi lặp | Code API `GET /products/:id`, chi tiết món, dữ liệu size/topping, validate ID, xử lý 404, test tương ứng | Code API thanh toán Ví/Thẻ mô phỏng, alt flow, idempotency key, API lịch sử/chi tiết đơn theo chủ đơn, test transaction/idempotency | API Payment & Lịch sử đơn, kiểm thử transaction & idempotency |
| 5 | **Trần Thế Duy** | • Task 1.2–1.3: Vẽ Use-case diagram tổng quát & Use-case diagram Checkout; rà soát AC viết thành test<br>• Task 2.3: Class diagram domain (7 lớp: `User`, `Product`, `Order`, `OrderItem`, `Payment`, `Promotion`, `LoyaltyTransaction`)<br>• Task 3.1: Tổng hợp lý do kiến trúc, ADR, trade-offs, test list theo AC | Code component Loading, Empty, Error, nút Retry; tích hợp menu/chi tiết; component test & test luồng xem menu | Code UI Login/Register, UI lịch sử đơn và theo dõi trạng thái đơn, ghép ít nhất 1 E2E test Menu → Xác nhận đơn | Bộ sơ đồ Use-case/Class, Ma trận truy vết, biên bản Review/Retro |
| 6 | **Nguyễn Tuấn Kiệt** | • Task 1.2: Đặc tả NFR hiệu năng, khả dụng, triển khai, cách đo; khởi tạo repository & commit history<br>• Task 2: Chuẩn hóa, lưu file nguồn (.puml) + ảnh kết xuất (.svg/.png), khởi tạo `traceability-matrix.md`<br>• Task 3.2: Khảo sát platform, vẽ Deployment diagram production (CDN, API, DB persistent, HTTPS, secrets) | Code bootstrap/config NestJS, API `GET /health` & test; repo structure, README, `.env.example`, DoD, dựng CI chặn merge khi lỗi | Code API cập nhật trạng thái đơn cho Barista/Staff, phân quyền RBAC, Docker Compose, CI/CD pipeline deploy, rollback | Pipeline CI/CD, Docker Compose, URL API/health, release tag, deployment diagram |

---

## 4. CHI TIẾT NỘI DUNG 5 TASK THEO ĐỀ BÀI

### Task 1: Khai thác và đặc tả yêu cầu (2 điểm)
- **Task 1.1:** Mô tả vấn đề nghiệp vụ BrewLite; 6 stakeholder chính (Khách hàng, Nhân viên quầy/Barista, Quản lý cửa hàng, Giảng viên/Khách hàng nghiệm thu, Nhóm phát triển, Đơn vị thanh toán); mục tiêu và kỳ vọng; in-scope MVP, scope mở rộng, out-of-scope; giả định, ràng buộc, rủi ro ban đầu.  
  👉 *Tạo phẩm bắt buộc:* `docs/requirements/context-and-scope.md`.
- **Task 1.2:** Xây dựng tài liệu SRS rút gọn:
  - Yêu cầu chức năng: mã `FR-01`, `FR-02`,... (menu, chi tiết món, giỏ hàng, xác thực, đặt đơn, thanh toán, lịch sử đơn, quản lý trạng thái đơn).
  - Yêu cầu phi chức năng: mã `NFR-01`, `NFR-02`,... (hiệu năng, bảo mật, tính khả dụng, khả năng triển khai).
  - Mức ưu tiên MoSCoW (Must, Should, Could, Won't).
  - Tiêu chí chấp nhận (Acceptance Criteria - AC) có thể kiểm chứng được cho từng yêu cầu.
  - Sơ đồ use-case tổng quát của toàn bộ hệ thống.
- **Task 1.3:** Đặc tả use-case trọng tâm: **Đặt và thanh toán đơn hàng (UC-CHK)**:
  - Sơ đồ use-case diagram phạm vi checkout.
  - Actor, Trigger, Tiền điều kiện (Preconditions), Hậu điều kiện (Postconditions).
  - Luồng sự kiện chính (Main Flow), các luồng thay thế (Alternative Flows), các luồng ngoại lệ (Exception Flows: hết hàng, chưa đăng nhập, thanh toán thất bại, thanh toán timeout).
  - Liên kết use-case với các mã FR/NFR tương ứng.

### Task 2: Mô hình hóa hệ thống (2 điểm)
- **Task 2.1 – Activity Diagram:** Cho các chức năng chính luồng end-to-end. Có điểm start/end, hành động user & system, decision/merge cho thành công/thất bại, swimlane cho nhiều actor/thành phần, nhánh hết hàng, chưa login, thanh toán lỗi.
- **Task 2.2 – Sequence Diagram:** Cho use-case trọng tâm. Tối thiểu 5 lifeline: `Customer → Next.js UI → NestJS API → Database → Payment Service`. Thể hiện rõ: request/response, thứ tự gọi API, kiểm tra JWT, validate dữ liệu, database transaction khi tạo đơn và trừ tồn kho, nhánh `alt` thanh toán thành công/thất bại, cơ chế chống gửi lặp (idempotency key), thông báo kết quả cuối cùng cho người dùng.
- **Task 2.3 – Class Diagram:** Ở mức domain cho tối thiểu **7 lớp**: `User`, `Product`, `Order`, `OrderItem`, `Payment`, `Promotion`, `LoyaltyTransaction`. Thể hiện thuộc tính chính, quan hệ, multiplicity và enum trạng thái.
- 👉 *Bắt buộc:* Lưu cả file nguồn PlantUML (`.puml`) và ảnh kết xuất (`.svg`/`.png`) trong `docs/diagrams/`.

### Task 3: Thiết kế kiến trúc (2 điểm)
- **Task 3.1 – Quyết định kiến trúc (ADR):**
  - Trình bày theo C4 hoặc kiến trúc phân lớp: Frontend Next.js/PWA; Backend NestJS theo module/domain; PostgreSQL & migration; Dịch vụ thanh toán mô phỏng; Logging, health check, config management; Ưu/nhược điểm và trade-offs.
  - Ghi các quyết định quan trọng thành ADR ngắn trong `docs/architecture/adr/` (ví dụ: `001-monorepo.md`, `002-auth-cookie-session-version.md`, `003-payment-consistency-idempotency.md`,...).
- **Task 3.2 – Deployment Diagram:**
  - Sơ đồ triển khai production trên nền tảng thực tế (Render, Railway, Fly.io, Azure, AWS, hoặc VPS).
  - Thể hiện: Thiết bị user/PWA, CDN phục vụ Next.js, Container NestJS API, PostgreSQL có persistent volume storage, Container Registry, giao thức HTTPS, mạng nội bộ, cổng giao tiếp, secret/env variables, health check & log, ranh giới Local / CI / Production.

### Task 4: Triển khai Sprint 1 (2 điểm)
- **Sprint Goal:** Tạo nền tảng kỹ thuật, tài liệu có kiểm soát phiên bản và một MVP đầu tiên chạy được cho luồng xem menu.
- **Task 4.1:** Thiết lập repo, cấu trúc thư mục, branch strategy, README.md, `.env.example`, backlog Sprint 1 & 2, DoD.
- **Task 4.2:** Quản lý tài liệu: đưa toàn bộ tạo phẩm Task 1–3 vào `docs/`.
- **Task 4.3:** MVP Sprint 1: API `GET /products`, `GET /products/:id`, UI Menu mobile-first Next.js, trạng thái Loading/Empty/Error/Retry, database seed dữ liệu mẫu, unit & component test.
- **Task 4.4 – CI Pipeline:** Thiết lập GitHub Actions chạy khi mở Pull Request:
  $$\text{Install} \longrightarrow \text{Lint} \longrightarrow \text{Unit Test} \longrightarrow \text{Build}$$
  *Bắt buộc chặn merge nếu lỗi. Minh chứng 1 lần CI thành công và 1 lần CI phát hiện lỗi.*

### Task 5: Triển khai Sprint 2, CI/CD và Delivery (2 điểm)
- **Sprint Goal:** Hoàn thành luồng end-to-end, tự động hóa đóng gói và triển khai một phiên bản production có thể truy cập được.
- **Task 5.1 – Hoàn thiện MVP:** Chi tiết tùy chọn size/topping, giỏ hàng, tính tổng tiền, đăng ký/đăng nhập/JWT, tạo đơn hàng, thanh toán Ví/Thẻ mô phỏng, xác nhận/trạng thái/lịch sử đơn, validate frontend & backend.
- **Task 5.2 – Tích hợp & Kiểm thử:** Unit test nghiệp vụ, integration test API tạo đơn/thanh toán, tối thiểu 1 test E2E luồng từ Menu đến Xác nhận đơn, migration/seed tái tạo DB sạch, `docker-compose.yml` chạy local 3 service (web, api, postgres), endpoint `GET /health`.
- **Task 5.3 – CD Pipeline:**
  $$\text{Push/Tag} \longrightarrow \text{Lint \& Test} \longrightarrow \text{Build} \longrightarrow \text{Docker Image} \longrightarrow \text{Push Registry} \longrightarrow \text{Deploy} \longrightarrow \text{Smoke Test}$$
  *Có tag SHA/semver, secret trong CI, migration an toàn, tự dừng và có cơ chế rollback khi deploy thất bại.*
- **Task 5.4 – Bàn giao sản phẩm:** URL Frontend HTTPS live, URL API & Health check, DB bảo mật không public, release tag & release notes, README hướng dẫn chạy local/deploy/rollback, video demo luồng thật, biên bản Sprint Review & Retrospective.

---

## 5. CẤU TRÚC REPOSITORY & BẢN ĐỒ MÃ NGUỒN

Repository hiện tại tuân thủ cấu trúc chuẩn monorepo:
```text
brewlite/
├── frontend/                     # Next.js 14/15 App Router, Tailwind CSS, Zustand, PWA
│   ├── src/app/                  # App routes: / (menu), /product/[id], /cart, /checkout, /login, /register, /orders, /barista
│   ├── src/components/           # Reusable UI: shell, cards, auth-provider, barista-board, ui components
│   ├── src/stores/               # Zustand stores: cart.ts (local persistence / server sync)
│   ├── src/services/             # Service adapters: contracts.ts, api.ts (REST), mock.ts (chỉ test/sandbox)
│   └── src/types/                # Domain DTOs và ViewModel types
├── backend/                      # NestJS REST API, Prisma ORM, PostgreSQL
│   ├── src/auth/                 # Module Auth: JWT, bcrypt, guards, RBAC, session_version
│   ├── src/products/             # Module Products: catalog, sizes, toppings, seed
│   ├── src/cart/                 # Module Cart: tính giá server-side, check tồn kho, merge cart
│   ├── src/orders/               # Module Orders & Inventory: state machine, inventory hold/release, staff KDS
│   ├── src/payments/             # Module Payments: gateway simulator, idempotency, journal, order lock
│   └── prisma/
│       ├── schema.prisma         # Single source of truth cho database schema
│       ├── migrations/           # 11 migrations SQL có phiên bản và lịch sử rõ ràng
│       └── seed.ts               # Seed data: 10 sản phẩm chuẩn, size, topping, tài khoản Barista
├── docs/                         # Toàn bộ tài liệu kỹ thuật của đồ án
│   ├── requirements/             # Task 1: context-and-scope.md, srs.md, use-case-checkout.md
│   ├── diagrams/                 # Task 2: file nguồn .puml và kết xuất .svg/.png
│   ├── architecture/             # Task 3: C4 diagrams, adr/ (Architecture Decision Records)
│   ├── assignment2/              # Tài liệu phân công, bàn giao Task 1-5
│   ├── API_CONTRACT.md           # Hợp đồng API chi tiết cho mọi endpoint
│   ├── ARCHITECTURE.md           # Kiến trúc hệ thống và luồng dữ liệu
│   └── traceability-matrix.md    # Ma trận truy vết bắt buộc FR -> UC -> Sơ đồ -> Code -> Test
├── stitch/                       # 9 export HTML gốc từ Google Stitch, DESIGN.md và screen.webp
├── docker-compose.yml            # Khởi chạy fullstack cục bộ: web (3000), api (3001), postgres (5434)
└── .env.example                  # Mẫu biến môi trường an toàn (không chứa secret thật)
```

---

## 6. MÔ HÌNH DỮ LIỆU (PRISMA SCHEMA, ENUMS, MIGRATIONS, SEED)

### 6.1. Các Enums Nghiệp vụ cốt lõi
- **`Role`**: `CUSTOMER` (khách hàng), `BARISTA` (nhân viên pha chế/quầy).
- **`UserStatus`**: `ACTIVE`, `INACTIVE`, `BANNED`.
- **`OrderStatus`**:
  - `PENDING`: Đơn mới tạo, tồn kho đã được giữ (inventory held), đang chờ thanh toán.
  - `PAID`: Thanh toán thành công, ghi nhận doanh thu, chuyển sang hàng đợi pha chế.
  - `PREPARING`: Barista đã nhận đơn và đang thực hiện pha chế món.
  - `READY`: Món đã sẵn sàng tại quầy để bàn giao cho khách.
  - `COMPLETED`: Khách đã nhận đồ uống (trạng thái kết thúc thành công).
  - `PAYMENT_FAILED`: Thanh toán thất bại, tồn kho được hoàn trả ngay lập tức.
  - `CANCELLED`: Đơn bị hủy (kèm `cancelReason`, hoàn tồn kho nếu trước đó đã giữ).
- **`PaymentMethod`**: `WALLET` (Ví điện tử mô phỏng), `CARD` (Thẻ ngân hàng mô phỏng).
- **`PaymentStatus`**: `PROCESSING`, `PAID`, `PAYMENT_FAILED`, `UNKNOWN`.
- **`ProductSizeCode`**: `S` (Nhỏ), `M` (Vừa), `L` (Lớn).

### 6.2. Các Thực thể Database Chính
1. **`User` (`users`)**: `id (UUID)`, `email (unique)`, `passwordHash`, `fullName`, `phone`, `role`, `loyaltyPoints`, `sessionVersion (int)`, `status`.
2. **`Product` (`products`)**: `id (UUID)`, `name`, `price (int VND)`, `imageUrl`, `stock (int)`, `version (int)`, `description`.
3. **`ProductSize` (`product_sizes`)**: `id`, `productId`, `code (S/M/L)`, `name`, `extraPrice (int)`, `available (bool)`, `isDefault (bool)`. Unique `(productId, code)`.
4. **`Topping` (`toppings`)** & **`ProductTopping` (`product_toppings`)**: `id`, `name`, `extraPrice`, `available`. Khóa chính composite `(productId, toppingId)`.
5. **`Cart` (`carts`)** & **`CartItem` (`cart_items`)**: Giỏ hàng theo `userId`. Giá **không lưu trong DB giỏ hàng** mà tính động từ `Product`. Quản lý `configKey` (size + toppings + ice + sugar + note) để gộp dòng trùng lặp.
6. **`Order` (`orders`)**: `id (UUID)`, `userId`, `status`, `version (optimistic lock)`, `subtotal`, `discountAmount`, `total`, `promotionCode`, `inventoryHeld (bool)`, `cancelReason (varchar 300)`, `completedAt (timestamp)`.
7. **`OrderItem` (`order_items`)** & **`OrderItemTopping` (`order_item_toppings`)**: Snapshot bất biến của sản phẩm tại thời điểm đặt hàng: `basePrice`, `sizePrice`, `unitPrice`, `qty`, `lineTotal`, `ice`, `sugar`, `note`.
8. **`OrderStatusHistory` (`order_status_history`)**: Nhật ký chuyển trạng thái đơn hàng bất biến: `orderId`, `fromStatus`, `toStatus`, `version`, `createdAt`.
9. **`Payment` (`payments`)**: `id (UUID)`, `userId`, `orderId`, `amount`, `method`, `status`, `gatewayStatus`, `appliedAt`, `idempotencyKey (UUID)`. Unique index `(userId, idempotencyKey)`.

> **Lưu ý cho Class Diagram (Task 2.3):** Đề bài yêu cầu tối thiểu 7 lớp domain: `User`, `Product`, `Order`, `OrderItem`, `Payment`, `Promotion`, `LoyaltyTransaction`. Hai thực thể `Promotion` và `LoyaltyTransaction` nằm trong mô hình phân tích miền nghiệp vụ (Domain Model) dù backend hiện tại tích hợp điểm thưởng trực tiếp vào User và chiết khấu demo qua service.

### 6.3. Dữ liệu Seed mẫu (10 sản phẩm)
Hệ thống có sẵn 10 đồ uống truyền thống Việt Nam:
1. Cà phê đen đá (25.000đ)
2. Cà phê sữa đá (29.000đ)
3. Bạc xỉu (29.000đ)
4. Cà phê muối (35.000đ)
5. Cà phê trứng (39.000đ)
6. Cà phê dừa (35.000đ)
7. Trà sen vàng (39.000đ)
8. Trà đào cam sả (35.000đ)
9. Trà vải hoa hồng (35.000đ)
10. Cacao đá đặc biệt (32.000đ)  
*(Mỗi sản phẩm có 3 size: S +0đ, M +6.000đ, L +10.000đ; Topping gồm Thạch cà phê +6.000đ, Kem sữa +8.000đ, Hạt sen +10.000đ).*

---

## 7. HỢP ĐỒNG API & LUỒNG NGHIỆP VỤ CỐT LÕI

Base URL: `http://localhost:3001/api`. Định dạng trao đổi: `JSON`. Đơn vị tiền tệ: `VND (số nguyên)`.

### 7.1. Bảng tóm tắt Endpoint REST API
| Phân hệ | Phương thức & URL | Auth & Quyền | Request Body tóm tắt | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET /health` | Public | Không | Kiểm tra trạng thái sống của API và Database |
| **Auth** | `POST /auth/register` | Public | `{name, email, password}` | Đăng ký tài khoản CUSTOMER, cấp cookie JWT |
| | `POST /auth/login` | Public | `{email, password}` | Đăng nhập, trả thông tin User và cookie JWT |
| | `GET /auth/me` | JWT | Không | Khôi phục phiên làm việc từ cookie |
| | `POST /auth/logout` | JWT | Không | Tăng `sessionVersion` trong DB, xóa sạch cookie |
| **Catalog** | `GET /products` | Public | Không | Lấy danh mục sản phẩm (hỗ trợ hiển thị menu) |
| | `GET /products/:id` | Public | Path UUID | Chi tiết sản phẩm, danh sách size và topping |
| **Cart** | `GET /cart` | JWT | Không | Lấy giỏ hàng của user (giá tính lại theo server) |
| | `POST /cart/items` | JWT | `{productId, size, toppingIds, qty, ice, sugar, note}` | Thêm món hoặc gộp số lượng món vào giỏ |
| | `PATCH /cart/items/:id` | JWT | `{quantity?, size?}` | Cập nhật số lượng hoặc đổi size món trong giỏ |
| | `DELETE /cart/items/:id` | JWT | Không | Xóa 1 món ra khỏi giỏ |
| | `DELETE /cart` | JWT | Không | Dọn sạch giỏ hàng |
| **Orders** | `POST /orders` | JWT Customer | `{items: [...], promotionCode?}` | **Tạo đơn PENDING, trừ giữ tồn kho, lưu snapshot giá** |
| | `GET /orders/me` | JWT Customer | Không | Lịch sử đơn hàng của chính khách hàng đăng nhập |
| | `GET /orders/:id` | JWT Owner | Không | Chi tiết đơn hàng và lịch sử trạng thái |
| **Payment** | `POST /payments` | JWT Owner | `{orderId, method, idempotencyKey}` | **Xử lý thanh toán mô phỏng (PAID / FAILED / UNKNOWN)** |
| **Staff KDS**| `GET /staff/orders` | JWT Barista | Query `status?` | Danh sách đơn hàng trong hàng đợi pha chế |
| | `PATCH /staff/orders/:id/status` | JWT Barista | `{status: "PREPARING"\|"READY"\|"COMPLETED"}` | Chuyển trạng thái đơn (ghi completedAt khi hoàn tất) |
| | `PATCH /staff/orders/:id/cancel` | JWT Barista | `{reason: string}` (1–300 ký tự) | Hủy đơn hàng kèm lý do, tự động hoàn trả tồn kho |

### 7.2. Cơ chế Bảo đảm Nhất quán & Chống gửi lặp (Payment Consistency)
- **Tạo đơn:** `POST /orders` chạy trong một DB transaction. Server kiểm tra tồn kho, trừ giữ kho (`inventoryHeld = true`), lưu `OrderItem` snapshot giá và tạo bản ghi lịch sử `OrderStatusHistory`. Trạng thái ban đầu: `PENDING`.
- **Thanh toán:**
  1. Client gửi `idempotencyKey` (UUID). Nếu gửi lại cùng key: hệ thống trả về đúng kết quả thanh toán trước đó (replay), không trừ tiền, không gọi gateway và không cộng điểm lần hai.
  2. Hệ thống khóa hàng `Order` (row-level lock) trong PostgreSQL để ngăn 2 request thanh toán đồng thời cho 1 đơn.
  3. Ghi `gatewayStatus` vào nhật ký bền vững trước khi chốt đơn.
  4. Khi thanh toán thành công (`PAID`): Order chuyển sang `PAID`, điểm thưởng loyalty được cộng tự động (`floor(total / 10000)`), giỏ hàng được dọn sạch.
  5. Khi thanh toán thất bại (`PAYMENT_FAILED`): Order chuyển sang `PAYMENT_FAILED`, tồn kho được hoàn trả ngay lập tức. Client được phép chọn phương thức khác và gửi lại với **idempotencyKey mới**.
  6. Khi kết quả chưa rõ (`UNKNOWN`): Giữ nguyên reservation kho, giữ đơn `PENDING`, chờ quy trình đối soát.

---

## 8. ĐẶC TẢ USE-CASE TRỌNG TÂM: ĐẶT & THANH TOÁN ĐƠN HÀNG (UC-CHK)

Use-case này được chọn theo yêu cầu mục 3.3 của đề bài:
- **Tên Use-case:** Đặt và thanh toán đơn hàng (Checkout and Payment).
- **Mã định danh:** `UC-CHK`.
- **Actor:** Khách hàng (Customer) – Chủ động; Cổng thanh toán mô phỏng (Simulated Payment Gateway) – Bị động.
- **Tiền điều kiện (Preconditions):**
  1. Khách hàng đã có tài khoản và đã đăng nhập hợp lệ (có JWT session).
  2. Giỏ hàng có ít nhất 1 sản phẩm hợp lệ (`valid = true`, `quantity > 0`).
  3. Tất cả các sản phẩm trong giỏ còn đủ số lượng tồn kho khả dụng tại thời điểm kiểm tra.
- **Hậu điều kiện (Postconditions):**
  - *Thành công:* Đơn hàng được tạo và chuyển sang `PAID`, tồn kho bị trừ thực tế, điểm thưởng được tích lũy, giỏ hàng được làm rỗng, đơn hàng xuất hiện trên màn hình KDS của Barista.
  - *Thất bại:* Đơn hàng chuyển sang `PAYMENT_FAILED` hoặc bị hủy, tồn kho được hoàn lại đầy đủ, giỏ hàng được giữ nguyên để khách hàng thao tác lại.
- **Các luồng chính & ngoại lệ:**
  - **Main Flow (10 bước):** Khách chọn checkout → Hệ thống hiển thị tóm tắt giỏ và tổng tiền → Khách chọn phương thức (Ví/Thẻ) → Bấm "Thanh toán ngay" → UI gửi `POST /orders` → API kiểm tra tồn kho, khóa giá, tạo đơn `PENDING` → UI tạo `idempotencyKey` và gửi `POST /payments` → API gọi cổng thanh toán mô phỏng → Cổng trả về `PAID` → API cập nhật đơn sang `PAID`, cộng điểm, xóa giỏ → UI điều hướng sang trang Kết quả thành công.
  - **Luồng ngoại lệ chính:**
    - `E01 - Chưa đăng nhập`: Chuyển hướng sang `/login`, lưu đường dẫn giỏ hàng để quay lại sau khi xác thực.
    - `E02 - Sản phẩm hết hàng khi đặt`: API trả `409 Conflict`, thông báo rõ món hết hàng, cập nhật lại giỏ.
    - `E03 - Thanh toán bị từ chối (FAILED)`: API cập nhật đơn sang `PAYMENT_FAILED`, hoàn kho; UI hiển thị màn hình thất bại kèm nút "Thử thanh toán lại" (cho phép đổi Ví/Thẻ với order cũ và idempotency key mới).
    - `E04 - Thanh toán bị timeout/mất mạng (UNKNOWN)`: Hệ thống không tự chuyển PAID, giữ đơn PENDING, thông báo khách hàng kiểm tra lại lịch sử giao dịch.

---

## 9. HIỆN TRẠNG DỰ ÁN, CÁC KHOẢNG TRỐNG KỸ THUẬT & VIỆC CẦN LÀM

### 9.1. Những gì đã hoàn thành và kiểm chứng (Kế thừa từ Assignment 1)
- **Mã nguồn hoàn chỉnh:** Next.js App Router (9 màn hình bám Stitch, responsive 1440/768/390), NestJS modular backend.
- **Database:** Prisma schema đầy đủ với 11 migrations SQL; seed 10 sản phẩm đồ uống hoàn chỉnh.
- **Backend Tests:** Đạt **272/272 tests PASS (25 test suites, 0 skipped)** trên PostgreSQL thật, kiểm thử toàn diện các ca concurrency (hai khách tranh mua món cuối), state machine, auth invalidation và payment consistency.
- **Browser Playwright:** Đã kiểm thử tự động 2 phiên đồng thời (Khách đặt đơn → Barista nhận và hoàn tất đơn trên KDS) đạt 100% PASS trên 3 kích thước màn hình.

### 9.2. Các khoảng trống bắt buộc phải thực hiện trong Assignment 2
1. **Tài liệu Task 1:**
   - Cần hoàn thiện và commit file chính thức: `docs/requirements/context-and-scope.md` (Khôi).
   - Ghép và chuẩn hóa tài liệu SRS toàn hệ thống: bảng mã `FR-01..FR-xx`, `NFR-01..NFR-xx`, tiêu chí chấp nhận AC, MoSCoW (Tri, Đông, Kiệt).
   - Vẽ Sơ đồ Use-case tổng quát và Sơ đồ Use-case Checkout trọng tâm (Duy).
2. **Mô hình hóa Task 2:**
   - Dựng Activity Diagram luồng end-to-end có swimlanes và nhánh lỗi (Khôi, Tri).
   - Dựng Sequence Diagram Checkout 5 lifelines có alt block và idempotency (Đông, Điệp).
   - Dựng Class Diagram domain đủ 7 thực thể (`User`, `Product`, `Order`, `OrderItem`, `Payment`, `Promotion`, `LoyaltyTransaction`) (Duy).
   - Xuất file `.puml` và `.svg` vào `docs/diagrams/` (Kiệt).
3. **Thiết kế kiến trúc Task 3:**
   - Soạn các ADR trong `docs/architecture/adr/` (Duy, Tri).
   - Chọn nền tảng Cloud (Render/Railway/Fly.io/VPS) và vẽ Deployment Diagram production chi tiết (Kiệt).
4. **Triển khai Sprint 1 (Task 4):**
   - Thiết lập GitHub Actions CI (`.github/workflows/ci.yml`): `Install → Lint → Unit Test → Build`.
   - Tạo bằng chứng CI thành công và CI chặn merge khi có lỗi.
   - Hoàn thiện MVP xem Menu có dữ liệu seed thật.
5. **Triển khai Sprint 2 & Delivery (Task 5):**
   - Hoàn thiện endpoint `GET /health` chính thức trong backend.
   - Thiết lập GitHub Actions CD (`.github/workflows/cd.yml`) tự động build Docker image, push registry, deploy và smoke test.
   - Triển khai production: có URL Web HTTPS và URL API hoạt động tại thời điểm chấm bài.
   - Hoàn thiện `docs/traceability-matrix.md` đối chiếu 100% các yêu cầu sang mã nguồn và test.
   - Quay video demo luồng end-to-end, viết tài liệu Release Notes và biên bản Sprint Retrospective.

---

## 10. HƯỚNG DẪN VẬN HÀNH & QUY TẮC CHỈ ĐẠO CHO AI

Khi một AI tiếp nhận tài liệu này để hỗ trợ hoàn thành Assignment 2, AI **bắt buộc phải tuân thủ nghiêm ngặt các chỉ thị sau**:
1. **Tuân thủ phân công công việc:** Tôn trọng vai trò phụ trách của từng thành viên theo Bảng mục 3.2. Khi người dùng yêu cầu làm phần việc của ai (ví dụ: Lê Quang Điệp làm Task 1.3, API chi tiết món, API thanh toán idempotency), AI phải tập trung đúng phạm vi đó, không tự tiện ghi đè hoặc thay đổi mã của thành viên khác.
2. **Quy tắc tuần tự:** Luôn kiểm tra xem Task trước đã hoàn thành tạo phẩm chưa trước khi đề xuất chuyển sang Task tiếp theo.
3. **Tính trung thực kỹ thuật:** Không bao giờ tự ý đánh dấu `VERIFIED_COMPLETE` nếu chưa có kết quả chạy build/test thực tế. Không giả mạo link PR hoặc kết quả chạy CI/CD.
4. **Định dạng sơ đồ:** Khi tạo sơ đồ UML (Use-case, Activity, Sequence, Class, Deployment), AI phải cung cấp mã nguồn **PlantUML (`@startuml ... @enduml`)** chuẩn cú pháp, rõ ràng, đẹp mắt để có thể biên dịch ra file `.svg` và `.png`.
5. **Code Style & Nguyên tắc sạch:**
   - Frontend Next.js: dùng TypeScript chặt chẽ, App Router, responsive Tailwind CSS, xử lý đầy đủ 4 trạng thái UI: `loading`, `empty`, `error`, `success`.
   - Backend NestJS: dùng DTO có `class-validator`, dependency injection, Prisma transaction an toàn, không để rò rỉ secret.
   - Kiểm thử: Mỗi tính năng viết ra phải đi kèm unit test hoặc integration test tương ứng có thể chạy được bằng Jest/Playwright.

---
*Tài liệu này là nguồn ngữ cảnh chuẩn xác và đầy đủ nhất về đồ án BrewLite Assignment 2.*

