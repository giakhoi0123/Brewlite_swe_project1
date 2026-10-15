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
| T05 | Giỏ | TV1+TV3 | VERIFIED_COMPLETE | T04 | frontend/src/stores, frontend/src/components/cart-sync.tsx, backend/src/cart | Thêm/sửa/xóa/tổng/badge; giỏ lưu theo tài khoản | Playwright: cấu hình riêng, tăng/giảm/xóa/clear, tổng, badge, refresh; 11 backend cart tests; HTTP PostgreSQL 12/12; luồng API mode khách→đăng ký→gộp→sửa→reload→đăng xuất/nhập 8/8 | TV4 nối `POST /orders` với `cart-pricing.ts` và xóa giỏ server khi đơn PAID |
| T06 | Orders API | TV4 | BACKEND_PENDING | Auth, products | backend/src/orders | POST /orders PENDING | Chưa chạy | Backend thật |
| T07 | Auth | TV1 | IN_PROGRESS | DB | backend/src/auth, frontend/src/app/login, frontend/src/app/register | Đăng ký/nhập/JWT/guard | 37 backend tests; HTTP DB cookie/role/hash/CSRF; Playwright đăng ký/role qua | Orders guard khi TV4 làm backend |
| T08 | Payment | TV1+TV5 | IN_PROGRESS | T06 | frontend/src/services, frontend/src/app/payment, backend/src/payments, backend/prisma | Wallet/Card, PAID/FAILED/UNKNOWN, idempotency | Sau khi hợp nhất Cart + Payment: frontend 7/7 unit + build; backend 56/56 + build; Prisma Client generate qua | Chờ TV4 cung cấp Orders port, chạy migration DB và API E2E thật |
| T09 | Xác nhận/lịch sử/Docker | TV1+TV6 | BACKEND_PENDING | T06,T08 | frontend/src/app/orders, compose | GET /orders/me, demo E2E | Playwright history/timeline + Compose 3 dịch vụ qua | Orders history backend thật |
| T10 | Logic nâng cao | TV4+TV5+TV6 | BACKEND_PENDING | T06,T08 | docs/API_CONTRACT.md | State machine, idempotency, stock, loyalty | Payment idempotency core test qua; mock state/points qua | Tích hợp Orders transaction/state, inventory, promotion/loyalty và E2E DB |

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

Đã hoàn thiện thêm một lượt đối chiếu UI với Stitch cho trang chủ, auth, chi tiết món và giỏ hàng, đặc biệt bố cục mobile. Browser smoke kiểm tra thêm món vào giỏ và không tràn ngang ở 390 px. Payment frontend đã có intent được kiểm tra, retry giữ đúng phương thức, xử lý UNKNOWN và lỗi xác minh; ở lượt Payment, frontend build/lint và 6 unit tests qua. Các màn Orders/Profile/Barista và phần tinh chỉnh hình ảnh Payment vẫn cần so sánh chi tiết khi tích hợp backend tương ứng.

Đã triển khai Next.js 13 route, auth/Products/Cart backend, adapter mock/REST, Dockerfile/Compose, docs và Git. Payment backend hiện có core service/controller/DTO, mock gateway, Prisma Payment schema/migration, idempotency claim và test HTTP/service; sau khi hợp nhất Cart + Payment, toàn bộ backend 56 tests và build qua, frontend 7 tests và production build qua. Compose/DB Payment chưa chạy migration trong lượt này. OrdersModule vẫn chưa có, nên `PaymentsModule` chưa đăng ký vào AppModule và endpoint thật chưa thể chạy end-to-end. Bước kế tiếp: TV4 cung cấp `PAYMENT_ORDER_PORT`, sau đó bật module, migrate PostgreSQL và chạy Payment API E2E. Các backend Promotion/Loyalty/Staff Orders vẫn còn thiếu.

## 6. Sở hữu nhóm
- TV1 Lead: kiến trúc frontend, toàn bộ UI, auth full stack, JWT, tài liệu, hạ tầng.
- TV2: backend products, catalog, tồn kho.
- TV3: tùy chọn sản phẩm, use case giỏ, nhất quán giá.
- TV4: backend orders, state machine, concurrency và inventory.
- TV5: backend payments, mock gateway, idempotency.
- TV6: backend order history, promotions, loyalty, hỗ trợ E2E.
