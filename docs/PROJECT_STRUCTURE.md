# Cấu trúc dự án BrewLite 1.0

Tài liệu này mô tả **mã nguồn đang được Git theo dõi** trong `BrewLite_swe-project_1`. Thư mục sinh ra khi cài hoặc chạy ứng dụng như `node_modules/`, `frontend/.next/`, `backend/dist/`, báo cáo Playwright và file `.env` cá nhân không nằm trong cây vì đã được bỏ qua bởi Git.

## Cây thư mục

```text
BrewLite_swe-project_1/
├── frontend/                              # Ứng dụng khách hàng và Barista (Next.js)
│   ├── src/
│   │   ├── app/                           # App Router: mỗi page.tsx tương ứng một màn hình
│   │   │   ├── page.tsx                   # / : trang chủ và thực đơn
│   │   │   ├── layout.tsx                 # Khung chung, font, Header, Footer
│   │   │   ├── globals.css                # Màu, kiểu chữ, bố cục, responsive
│   │   │   ├── icon.png, favicon.ico      # Icon ứng dụng
│   │   │   ├── products/[id]/page.tsx     # /products/:id : chi tiết và tùy chỉnh món
│   │   │   ├── cart/page.tsx              # /cart : giỏ hàng
│   │   │   ├── checkout/page.tsx          # /checkout : xác nhận đơn và chọn thanh toán
│   │   │   ├── payment/[id]/[stage]/page.tsx # Kết quả/trạng thái thanh toán
│   │   │   ├── orders/page.tsx            # /orders : lịch sử đơn
│   │   │   ├── orders/[id]/page.tsx       # /orders/:id : chi tiết và theo dõi đơn
│   │   │   ├── login/page.tsx             # /login : đăng nhập
│   │   │   ├── register/page.tsx          # /register : đăng ký
│   │   │   ├── profile/page.tsx           # /profile : hồ sơ và điểm thưởng
│   │   │   ├── barista/dashboard/page.tsx # /barista/dashboard : KDS tổng quan
│   │   │   ├── barista/[view]/page.tsx     # /barista/orders, preparing, ready, history
│   │   │   ├── profile/profile.css        # Thẻ thành viên và lịch sử theo Stitch
│   │   │   └── forbidden/page.tsx         # /forbidden : thông báo không đủ quyền
│   │   ├── components/                    # Thành phần giao diện dùng chung
│   │   │   ├── shell.tsx                  # Header, Footer, thông báo demo
│   │   │   ├── ui.tsx                     # Ảnh sản phẩm, nút số lượng, trạng thái, timeline
│   │   │   ├── auth-provider.tsx          # Trạng thái đăng nhập toàn ứng dụng
│   │   │   ├── auth-feature.tsx           # Khối giới thiệu tại màn đăng nhập/đăng ký
│   │   │   └── order-summary.tsx          # Tóm tắt tiền trong giỏ/đơn hàng
│   │   ├── services/                      # Ranh giới giữa UI và nguồn dữ liệu
│   │   │   ├── contracts.ts               # Interface cho sản phẩm, đơn, thanh toán...
│   │   │   ├── index.ts                   # Chọn adapter mock hoặc REST theo cấu hình
│   │   │   ├── api.ts, http.ts            # REST adapter và HTTP client
│   │   │   ├── auth.ts                    # Đăng ký/đăng nhập thật qua backend
│   │   │   ├── mock.ts, mock.test.ts      # Demo localStorage và unit test
│   │   │   └── demo-products.ts, demo-image-urls.json # Dữ liệu/ảnh demo
│   │   ├── stores/cart.ts                 # Giỏ hàng Zustand, lưu qua refresh
│   │   └── types/domain.ts                # Kiểu dữ liệu và hàm tính tiền dùng chung
│   ├── public/images/products/            # SVG dự phòng khi ảnh sản phẩm không tải
│   ├── e2e/                               # Playwright: luồng demo và Products API
│   │   ├── flow.spec.ts
│   │   └── api-menu.spec.ts
│   ├── Dockerfile                         # Build/chạy frontend trong Compose
│   ├── package.json, package-lock.json    # Phụ thuộc và lệnh npm
│   └── next.config.ts, playwright.config.ts, postcss.config.mjs,
│       eslint.config.mjs, tsconfig.json    # Cấu hình framework và công cụ
├── backend/                               # API NestJS
│   ├── src/
│   │   ├── main.ts, app.module.ts         # Khởi động API và khai báo module
│   │   ├── configuration.ts               # Đọc cấu hình môi trường
│   │   ├── prisma.module.ts, prisma.service.ts # Kết nối PostgreSQL qua Prisma
│   │   ├── auth/                          # Auth thật: cookie JWT, bcrypt, CSRF, role
│   │   │   ├── auth.controller.ts         # Các HTTP endpoint đăng ký/đăng nhập/me/logout
│   │   │   ├── auth.service.ts            # Xử lý tài khoản và mật khẩu
│   │   │   ├── auth.module.ts             # Khai báo module Auth
│   │   │   ├── dto/                       # Kiểm tra dữ liệu login/register
│   │   │   ├── jwt-auth.guard.ts, jwt.strategy.ts
│   │   │   ├── roles.decorator.ts, roles.guard.ts
│   │   │   ├── csrf.middleware.ts         # Bảo vệ yêu cầu thay đổi dữ liệu
│   │   │   └── *.spec.ts                   # Test auth, role, CSRF
│   │   ├── products/                      # Products API thật: danh sách, chi tiết, tùy chọn
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   ├── products.module.ts
│   │   │   ├── product-detail.ts
│   │   │   └── *.spec.ts                   # Test service và HTTP
│   │   └── barista/barista.controller.ts  # Endpoint mẫu kiểm tra role Barista
│   ├── prisma/
│   │   ├── schema.prisma                  # Bảng User/Product và các kiểu dữ liệu DB
│   │   ├── migrations/                    # Lịch sử thay đổi schema PostgreSQL
│   │   ├── seed.ts, seed-products.ts      # Dữ liệu mẫu và tài khoản Barista local
│   │   └── seed-product-customization.ts  # Seed size/topping của sản phẩm
│   ├── test/                              # E2E/backend fixture và benchmark
│   ├── Dockerfile                         # Build/chạy backend trong Compose
│   └── package.json, package-lock.json    # Phụ thuộc và lệnh npm
├── stitch/                                # Bản thiết kế tham chiếu, không chạy trong app
│   ├── artisanal_vietnamese_coffee_ordering/DESIGN.md # Design tokens
│   └── 9 thư mục màn hình                 # Mỗi thư mục có code.html và screen.webp
├── docs/                                  # Tài liệu quản lý và bàn giao
│   ├── PROJECT_STRUCTURE.md              # Cây thư mục và bản đồ chức năng này
│   ├── PROJECT_CONTEXT.md                # Ngữ cảnh và giới hạn hiện tại
│   ├── IMPLEMENTATION_PLAN.md            # Tiến độ Task, owner, tiêu chí nghiệm thu
│   ├── PROJECT_STATUS.md                 # Trạng thái từng tính năng
│   ├── ARCHITECTURE.md                   # Kiến trúc tổng thể
│   ├── API_CONTRACT.md                   # Hợp đồng API cho phần backend tiếp theo
│   ├── INTEGRATION_GUIDE.md              # Hướng dẫn nối frontend/backend
│   ├── TEAM_HANDOFF.md                   # Phân công và bàn giao nhóm
│   └── TESTING.md                        # Kết quả và cách chạy kiểm thử
├── scripts/smoke_http.py                 # Smoke test HTTP/DB sau khi chạy Compose
├── docker-compose.yml                    # PostgreSQL + backend + frontend
├── .env.example                          # Mẫu biến môi trường; .env thật không commit
├── .gitignore                            # Loại trừ file sinh ra, phụ thuộc và bí mật
├── package.json                          # Lệnh npm chung ở thư mục gốc
├── AGENTS.md                             # Hướng dẫn bảo trì cho phiên làm việc sau
└── README.md                             # Tổng quan, cài đặt, chạy và kiểm thử
```

`frontend/AGENTS.md` và `frontend/CLAUDE.md` là hướng dẫn công cụ trong frontend; các file cấu hình NestJS/Jest/TypeScript và test chi tiết trong backend cũng được giữ ở đúng thư mục của chúng. Cây trên gom các file cùng vai trò vào một dòng để người đọc nhìn được kiến trúc trước khi mở từng file.

## Bản đồ chức năng

| Chức năng | Giao diện | Xử lý dữ liệu hiện tại |
|---|---|---|
| Thực đơn và chi tiết món | `frontend/src/app/page.tsx`, `products/[id]/page.tsx` | `frontend/src/services/` → `backend/src/products/` trong API mode; có mock mode |
| Giỏ hàng | `frontend/src/app/cart/page.tsx` | `frontend/src/stores/cart.ts` và `frontend/src/types/domain.ts` |
| Đăng ký/đăng nhập/phân quyền | `frontend/src/app/login/`, `register/`, `components/auth-provider.tsx` | **Backend thật** ở `backend/src/auth/`, PostgreSQL qua Prisma |
| Checkout, thanh toán, đơn hàng, điểm thưởng | `frontend/src/app/checkout/`, `payment/`, `orders/`, `profile/` | Orders/Payment dùng REST ở API mode; `backend/src/payments/` tạo URL VNPAY và xử lý IPN, mock tách riêng chỉ cho phát triển |
| Barista | `frontend/src/components/barista-board.tsx`, `barista-board.css`, `frontend/src/app/barista/` | KDS 5 view dùng adapter mock/API; `backend/src/barista/` hiện chỉ có endpoint mẫu kiểm tra role, Staff Orders API chờ TV4 |
| Cơ sở dữ liệu | Không áp dụng | `backend/prisma/schema.prisma`, `migrations/`, các file `seed*.ts` |
| Triển khai và kiểm thử | Không áp dụng | `docker-compose.yml`, hai `Dockerfile`, `frontend/e2e/`, `backend/test/`, `scripts/smoke_http.py` |

## Các thư mục thiết kế Stitch

Mỗi thư mục màn hình dưới đây giữ `code.html` và ảnh tham chiếu `screen.webp`. Ảnh WebP được nén từ ảnh PNG ban đầu để repo nhẹ hơn; HTML và `DESIGN.md` là nguồn tham khảo giao diện.

| Màn hình | Thư mục trong `stitch/` |
|---|---|
| Trang chủ / thực đơn | `trang_ch_th_c_n_brewlite/` |
| Chi tiết / tùy chỉnh sản phẩm | `chi_ti_t_s_n_ph_m_t_y_ch_nh_brewlite/` |
| Giỏ hàng | `gi_h_ng_brewlite/` |
| Đăng nhập / đăng ký | `ng_nh_p_ng_k_brewlite/` |
| Thanh toán đang xử lý | `thanh_to_n_ang_x_l_brewlite/` |
| Kết quả thanh toán | `k_t_qu_thanh_to_n_th_nh_c_ng_th_t_b_i_brewlite/` |
| Đơn hàng / theo dõi | `n_h_ng_c_a_t_i_theo_d_i_ti_n_tr_nh_brewlite/` |
| Hồ sơ / điểm thành viên | `h_s_c_nh_n_t_ch_i_m_th_nh_vi_n_brewlite/` |
| Bảng điều khiển Barista | `b_ng_i_u_khi_n_barista_x_l_pha_ch_brewlite/` |
