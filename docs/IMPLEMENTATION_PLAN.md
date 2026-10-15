# Kế hoạch triển khai BrewLite 1.0

## 1. Tổng quan
BrewLite là ứng dụng đặt cà phê và thanh toán không tiền mặt cho bài tập Công nghệ phần mềm. Luồng khách hàng: xem menu → tùy chỉnh món → giỏ → đăng nhập → đặt đơn PENDING → thanh toán → theo dõi. Luồng Barista tùy chọn: PAID → PREPARING → READY → COMPLETED. Stack: Next.js App Router, React, TypeScript, Tailwind, Zustand; NestJS, PostgreSQL, Prisma, class-validator, bcrypt, JWT; Docker Compose.

## 2. Lộ trình
| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Kiểm kê 9 màn Stitch, DESIGN.md, trạng thái repo | VERIFIED_COMPLETE |
| 1 | Kế hoạch và tài liệu ban đầu | VERIFIED_COMPLETE |
| 2 | Monorepo, cấu hình, môi trường | VERIFIED_COMPLETE |
| 3 | Thành phần UI dùng chung | VERIFIED_COMPLETE |
| 4 | Menu và sản phẩm | VERIFIED_COMPLETE |
| 5 | Tùy chỉnh và giỏ | VERIFIED_COMPLETE |
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
| T01 | Khởi tạo dự án | TV1 | VERIFIED_COMPLETE | Không | README, frontend, backend, compose | Chạy được 3 thành phần | Compose 3 container chạy; frontend/backend HTTP 200; Git và README có | Không |
| T02 | Products API | TV2 | VERIFIED_COMPLETE | DB | backend/src/products | GET /products trả JSON | PostgreSQL seed 10 món; GET list/detail HTTP 200; backend tests qua | Không |
| T03 | Menu | TV1+TV2 | VERIFIED_COMPLETE | T02 | frontend/src/app/page.tsx | API, loading, empty | Playwright API mode: 10 món, loading/empty/error/retry; DB thật | Không |
| T04 | Tùy chỉnh | TV1+TV3 | VERIFIED_COMPLETE | T02 | frontend/src/app/products | Size, topping, giá | Playwright API mode: S/M/L, topping, giá động, thêm giỏ | Chính sách giá lâu dài cần TV3 xác nhận |
| T05 | Giỏ | TV1+TV3 | VERIFIED_COMPLETE | T04 | frontend/src/stores | Thêm/sửa/xóa/tổng/badge | Playwright: cấu hình riêng, tăng/giảm/xóa/clear, tổng, badge, refresh | Không |
| T06 | Orders API | TV4 | BACKEND_PENDING | Auth, products | backend/src/orders | POST /orders PENDING | Chưa chạy | Backend thật |
| T07 | Auth | TV1 | IN_PROGRESS | DB | backend/src/auth, frontend/src/app/login, frontend/src/app/register | Đăng ký/nhập/JWT/guard | 37 backend tests; HTTP DB cookie/role/hash/CSRF; Playwright đăng ký/role qua | Orders guard khi TV4 làm backend |
| T08 | Payment | TV1+TV5 | BACKEND_PENDING | T06 | frontend/src/services, frontend/src/app/payment | Wallet/Card, PAID/FAILED | Unit + Playwright Wallet/Card, fail/retry/success/unknown qua | TV5 làm backend payment/idempotency |
| T09 | Xác nhận/lịch sử/Docker | TV1+TV6 | BACKEND_PENDING | T06,T08 | frontend/src/app/orders, compose | GET /orders/me, demo E2E | Playwright history/timeline + Compose 3 dịch vụ qua | Orders history backend thật |
| T10 | Logic nâng cao | TV4+TV5+TV6 | BACKEND_PENDING | T06,T08 | docs/API_CONTRACT.md | State machine, idempotency, stock, loyalty | Mock state/idempotency/points tests qua | Toàn bộ 4 hạng mục backend |

## 4. Checklist
- [x] Kiểm kê thiết kế Stitch và dự án đích.
- [x] Khởi tạo frontend/backend, build và kiểm tra cấu hình Compose.
- [x] Trang menu, chi tiết, giỏ; build và test phép tính/luồng mock.
- [x] Auth thật với PostgreSQL, cookie session và phân quyền HTTP.
- [x] Checkout, kết quả, lịch sử, loyalty, Barista với adapter; build và test mock.
- [x] Chạy build, test mock/backend và cập nhật tài liệu.
- [x] Chạy PostgreSQL thật, migration/seed, auth HTTP E2E và Compose đầy đủ.
- [x] Kiểm tra Playwright trên desktop/mobile ở mock mode và API mode.

## 5. Công việc hiện tại
Cấu trúc thư mục hiện hành và vị trí từng chức năng đã được ghi trong `docs/PROJECT_STRUCTURE.md` để nhóm và giảng viên tra cứu từ README.

Đã xử lý CORS cho trường hợp frontend chạy thêm tại `localhost:3002`: backend đọc danh sách `FRONTEND_ORIGIN` phân tách bằng dấu phẩy cho cả CORS và cookie origin guard. Cấu hình Compose lấy giá trị từ `.env`; cần build lại backend sau khi cập nhật mã. Kiểm tra trong `docs/TESTING.md`.

Đã hoàn thiện thêm một lượt đối chiếu UI với Stitch cho trang chủ, auth, chi tiết món và giỏ hàng, đặc biệt bố cục mobile. Browser smoke kiểm tra thêm món vào giỏ và không tràn ngang ở 390 px; frontend build/lint và 3 unit tests qua. Các màn Orders/Payment/Profile/Barista vẫn cần một lượt so sánh chi tiết riêng với Stitch khi nhóm tích hợp backend tương ứng.

Đã triển khai Next.js 13 route, auth/Products backend, adapter mock/REST, Dockerfile/Compose, docs và Git. Build và lint hai phía qua; 3 frontend tests + 37 backend tests qua. Compose đã build/chạy 3 container: Next 3000, Nest 3001, PostgreSQL 5434. Migration/seed chạy, 10 Products có trên DB, HTTP smoke auth/role/CSRF/Products qua, bcrypt hash được đối chiếu trong DB. Playwright 3 bài mock + 2 bài API mode qua, gồm desktop/mobile và các nhánh thanh toán. Ảnh Stitch đã được chuyển từ PNG sang WebP và icon thu nhỏ để giảm dung lượng nhánh; HTML và DESIGN.md vẫn là tài liệu thiết kế. Backend Orders/Payments/Promotion/Loyalty/Staff Orders thuộc TV4–TV6 chưa có. Bước kế tiếp: tích hợp Orders/Payments/History/Promotion/Loyalty backend theo owner và mở rộng E2E sang API thật. File chính: `frontend/src/app`, `frontend/src/services`, `frontend/src/stores/cart.ts`, `backend/src/auth`, `backend/src/products`, `backend/prisma`, `docker-compose.yml`, `scripts/smoke_http.py`, `README.md`, `docs/*`.

## 6. Sở hữu nhóm
- TV1 Lead: kiến trúc frontend, toàn bộ UI, auth full stack, JWT, tài liệu, hạ tầng.
- TV2: backend products, catalog, tồn kho.
- TV3: tùy chọn sản phẩm, use case giỏ, nhất quán giá.
- TV4: backend orders, state machine, concurrency và inventory.
- TV5: backend payments, mock gateway, idempotency.
- TV6: backend order history, promotions, loyalty, hỗ trợ E2E.
