# Kế hoạch triển khai BrewLite 1.0

## 1. Tổng quan
BrewLite là ứng dụng đặt cà phê và thanh toán không tiền mặt cho bài tập Công nghệ phần mềm. Luồng khách hàng: xem menu → tùy chỉnh món → giỏ → đăng nhập → đặt đơn PENDING → thanh toán → theo dõi. Luồng Barista tùy chọn: PAID → PREPARING → READY → COMPLETED. Stack: Next.js App Router, React, TypeScript, Tailwind, Zustand; NestJS, PostgreSQL, Prisma, class-validator, bcrypt, JWT; Docker Compose.

## 2. Lộ trình
| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Kiểm kê 9 màn Stitch, DESIGN.md, trạng thái repo | VERIFIED_COMPLETE |
| 1 | Kế hoạch và tài liệu ban đầu | VERIFIED_COMPLETE |
| 2 | Monorepo, cấu hình, môi trường | UI_COMPLETED |
| 3 | Thành phần UI dùng chung | UI_COMPLETED |
| 4 | Menu và sản phẩm | UI_COMPLETED |
| 5 | Tùy chỉnh và giỏ | UI_COMPLETED |
| 6 | Auth full stack | IN_PROGRESS |
| 7 | Checkout và đơn hàng | UI_COMPLETED |
| 8 | Kết quả thanh toán | UI_COMPLETED |
| 9 | Lịch sử, theo dõi, ưu đãi, điểm | UI_COMPLETED |
| 10 | Barista | UI_COMPLETED |
| 11 | Adapter và hợp đồng API | UI_COMPLETED |
| 12 | Kiểm thử, Docker, bàn giao | IN_PROGRESS |

## 3. Theo dõi Task chính thức
Chỉ đổi thành `VERIFIED_COMPLETE` khi toàn bộ tiêu chí của Task đã chạy kiểm thử thành công. `UI_COMPLETED` chỉ phản ánh frontend; `BACKEND_PENDING` phản ánh backend chưa tích hợp.

| ID | Mô tả | Chủ sở hữu | Trạng thái | Phụ thuộc | Tệp liên quan | Tiêu chí nghiệm thu | Bằng chứng kiểm thử | Việc còn lại |
|---|---|---|---|---|---|---|---|---|
| T01 | Khởi tạo dự án | TV1 | IN_PROGRESS | Không | README, frontend, backend, compose | Chạy được 3 thành phần | Frontend/backend build qua; Compose config qua, DB chưa chạy | Kiểm tra E2E DB |
| T02 | Products API | TV2 | IN_PROGRESS | DB | backend/src/products | GET /products trả JSON | Products backend tests qua; DB chưa chạy | Chạy PostgreSQL, seed và HTTP thật |
| T03 | Menu | TV1+TV2 | UI_COMPLETED | T02 | frontend/src/app/page.tsx | API, loading, empty | Next build, lint và HTTP / qua | Browser E2E + API DB thật |
| T04 | Tùy chỉnh | TV1+TV3 | UI_COMPLETED | T02 | frontend/src/app/products | Size, topping, giá | Build và test giá số nguyên qua | Browser E2E, thống nhất giá backend |
| T05 | Giỏ | TV1+TV3 | UI_COMPLETED | T04 | frontend/src/stores | Thêm/sửa/xóa/tổng/badge | Build và test tổng/config qua | Browser E2E persist/badge |
| T06 | Orders API | TV4 | BACKEND_PENDING | Auth, products | backend/src/orders | POST /orders PENDING | Chưa chạy | Backend thật |
| T07 | Auth | TV1 | IN_PROGRESS | DB | backend/src/auth, frontend/src/app/login, frontend/src/app/register | Đăng ký/nhập/JWT/guard | 37 backend tests gồm auth/RBAC/CSRF qua | PostgreSQL E2E và session trên browser |
| T08 | Payment | TV1+TV5 | BACKEND_PENDING | T06 | frontend/src/services, frontend/src/app/payment | Wallet/Card, PAID/FAILED | 3 frontend mock tests qua | TV5 làm backend payment/idempotency |
| T09 | Xác nhận/lịch sử/Docker | TV1+TV6 | BACKEND_PENDING | T06,T08 | frontend/src/app/orders, compose | GET /orders/me, demo E2E | Build, 10 route HTTP 200, Compose config qua | Orders history backend, Docker E2E |
| T10 | Logic nâng cao | TV4+TV5+TV6 | BACKEND_PENDING | T06,T08 | docs/API_CONTRACT.md | State machine, idempotency, stock, loyalty | Mock state/idempotency/points tests qua | Toàn bộ 4 hạng mục backend |

## 4. Checklist
- [x] Kiểm kê thiết kế Stitch và dự án đích.
- [x] Khởi tạo frontend/backend, build và kiểm tra cấu hình Compose.
- [x] Trang menu, chi tiết, giỏ; build và test phép tính/luồng mock.
- [ ] Auth thật với PostgreSQL và phân quyền.
- [x] Checkout, kết quả, lịch sử, loyalty, Barista với adapter; build và test mock.
- [x] Chạy build, test mock/backend và cập nhật tài liệu.
- [ ] Chạy PostgreSQL thật, auth E2E, kiểm tra tương tác trình duyệt và Compose đầy đủ.

## 5. Công việc hiện tại
Đã triển khai Next.js frontend 13 route, auth/Products backend, adapter mock/REST, Dockerfile/Compose, docs và Git. Build frontend/backend qua; 3 frontend tests + 37 backend tests qua; lint cả hai sạch. Compose config hợp lệ; 10 route trả HTTP 200 khi chạy Next production. Docker daemon không chạy nên chưa xác nhận PostgreSQL thật hoặc browser E2E. Các module backend Orders/Payments/Promotion/Loyalty/Staff Orders thuộc TV4–TV6 vẫn chờ. Bước tiếp theo: khởi động Docker/DB, chạy migration/seed và auth E2E; sau đó tích hợp backend theo owner. File chính: `frontend/src/app`, `frontend/src/services`, `frontend/src/stores/cart.ts`, `backend/src/auth`, `backend/src/products`, `backend/prisma`, `docker-compose.yml`, `README.md`, `docs/*`.

## 6. Sở hữu nhóm
- TV1 Lead: kiến trúc frontend, toàn bộ UI, auth full stack, JWT, tài liệu, hạ tầng.
- TV2: backend products, catalog, tồn kho.
- TV3: tùy chọn sản phẩm, use case giỏ, nhất quán giá.
- TV4: backend orders, state machine, concurrency và inventory.
- TV5: backend payments, mock gateway, idempotency.
- TV6: backend order history, promotions, loyalty, hỗ trợ E2E.
