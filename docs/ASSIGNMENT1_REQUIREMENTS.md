# Assignment 1 — yêu cầu và ghi chú phục vụ báo cáo

Ngày đọc và lưu: **2026-10-27**. Mục đích: ghi nhớ tài liệu người dùng cung cấp để đối chiếu khi soạn báo cáo; không phải biên bản nghiệm thu hoặc yêu cầu triển khai thêm chức năng trong lượt này.

## 1. Nguồn và cách sử dụng

| Nguồn | Vai trò | Phạm vi đã đọc |
|---|---|---|
| `C:/Users/Quang Diep/Downloads/BrewLite-CongNghePhanMem (3).pdf` | Đề gốc BrewLite v1.0, môn Công nghệ Phần mềm, HK I năm học 2026–2027, Đại học Sài Gòn | Toàn bộ 8 trang PDF: bìa và trang đánh số 1–7 |
| `C:/Users/Quang Diep/Downloads/BrewLite_Assignment1 (1).pdf` | Báo cáo Bài tập 1 của nhóm: User Stories, cấu trúc và đối chiếu đề | Toàn bộ 9 trang; mốc đối chiếu của báo cáo là `main`, commit `2c45463`, ngày 25/10/2026 |

SHA-256 để nhận diện đúng phiên bản:

- Đề gốc: `08EFC9A6CC247123500419F01160C76712EC773AFFC998D2193F2873EF5312CC`.
- Báo cáo nhóm: `5CA19486D7FC4DC7FFA70177F8081AAC9CC9BC20AEDD9FB3B715935D8A4620EA`.

Các số trang dưới đây là **số in trên tài liệu**, không phải chỉ số trang PDF. Đề gốc là căn cứ yêu cầu; báo cáo nhóm là tài liệu diễn giải/phân công và nhận định tại một mốc mã nguồn. Các yêu cầu trong PDF được lưu làm dữ liệu tham chiếu, không tự động trở thành lệnh sửa code, chạy triển khai hoặc thay đổi owner. Người dùng hiện chỉ yêu cầu đọc và ghi nhớ để làm báo cáo.

## 2. Phạm vi, công nghệ và chất lượng theo đề gốc

- Sản phẩm: đặt đồ uống và thanh toán không tiền mặt, giảm thời gian chờ và nhận đồ tại quầy.
- **Bắt buộc Next.js frontend và NestJS backend**; giao tiếp REST/JSON. Đề gợi ý PostgreSQL và Prisma/TypeORM; bảng công nghệ có TypeScript, TailwindCSS, React Query/Zustand, class-validator, JWT/Passport, Docker Compose và Git (mục 1, 6).
- MVP: menu có ảnh/tên/giá; chi tiết và size/topping; giỏ thêm/sửa/xóa và tổng tiền; tài khoản JWT; tạo đơn và thanh toán; xác nhận và lịch sử đơn (mục 4.1).
- **Barista nằm ngoài MVP, là phần mở rộng** (mục 3.2). Tuy nhiên máy trạng thái backend đến COMPLETED vẫn là yêu cầu bắt buộc của Task 10; không được bỏ Task 10 vì UI Barista là mở rộng.
- NFR: **API phản hồi < 500 ms với dữ liệu mẫu**, mật khẩu băm, JWT, validate đầu vào, phù hợp trên các trình duyệt web (mục 4.2). Chỉ kết luận đạt hiệu năng/tương thích khi có phép đo và kiểm thử tương ứng.
- Luồng chính: menu → chọn món/size/topping → giỏ và tổng tiền → đăng nhập nếu cần → thanh toán → xác nhận mã đơn → nhận đồ (mục 5). Năm wireframe ở mục 7 là tham khảo.

## 3. Mười task chấm điểm

Theo mục 8, **mỗi task đạt Definition of Done được 1 điểm, tổng 10 điểm**. Bảng này lưu yêu cầu, không chấm điểm hoặc xác nhận trạng thái repo.

| Task | Yêu cầu/tiêu chí chính theo đề |
|---|---|
| 1 | Hai phần frontend Next.js/backend NestJS, chạy được Hello, có README, Git và `.env.example`. |
| 2 | `GET /products` trả menu JSON gồm id, tên, giá, ảnh từ dữ liệu mẫu/CSDL. |
| 3 | Next.js gọi Products API, hiển thị lưới sản phẩm và loading/empty state. |
| 4 | Trang chi tiết, size S/M/L, topping, tính giá theo lựa chọn. |
| 5 | Giỏ thêm/sửa số lượng/xóa; state Zustand/Context; tổng tiền và badge số lượng. Đề không bắt buộc đồng bộ giỏ lên server. |
| 6 | `POST /orders` nhận giỏ, validate bằng class-validator, lưu PENDING và trả mã đơn. |
| 7 | `POST /auth/register`, `POST /auth/login`, bcrypt, phát JWT, guard bảo vệ đặt đơn. |
| 8 | **Mock payment cho phép chọn Ví/Thẻ**, gọi `POST /payments`; thành công → PAID, lỗi → PAYMENT_FAILED. Story mẫu mục 4.3 yêu cầu giữ giỏ khi lỗi, hiện mã đơn/xác nhận khi thành công. |
| 9 | Màn xác nhận mã/trạng thái; `GET /orders/me`; Docker Compose chạy frontend, backend, DB; README và demo end-to-end. |
| 10 | Đủ bốn nhóm nghiệp vụ: state machine, payment idempotency, tồn kho đồng thời, khuyến mãi và điểm thưởng. |

### Chi tiết Task 10 (mục 9–9.1)

1. Máy trạng thái: `PENDING → PAID → PREPARING → READY → COMPLETED`; chặn chuyển sai. Có nhánh PAYMENT_FAILED/thử lại và CANCELLED; COMPLETED/CANCELLED là trạng thái kết thúc. Khi cần đặc tả đầy đủ cạnh hủy/retry phải đối chiếu trực tiếp sơ đồ trang 7 và ma trận code hiện hành, không suy diễn từ phần văn bản trích xuất.
2. Idempotency: dùng `Idempotency-Key`; yêu cầu thanh toán lặp không trừ tiền/đặt đơn hai lần.
3. Tồn kho: transaction **và optimistic locking**, không bán quá số lượng khi nhiều khách đặt đồng thời.
4. Khuyến mãi/loyalty: áp mã hợp lệ, cộng điểm sau khi đơn PAID.

Đề yêu cầu unit/integration test chứng minh ít nhất: chặn chuyển trạng thái sai; gửi hai lần cùng key chỉ tạo một đơn; đặt đồng thời không vượt tồn kho. Không coi chỉ có tên file test hoặc test mock là bằng chứng DB thật đã đạt.

## 4. Scrum, Definition of Done và bàn giao

Theo mục 2, 10, 11:

- Vai trò: Product Owner, Scrum Master, Development Team.
- Sự kiện: Sprint Planning, Daily Scrum, Sprint Review, Sprint Retrospective.
- Tạo phẩm: Product Backlog, Sprint Backlog, Increment.
- Kế hoạch **gợi ý**: Sprint 1 = Task 1–4; Sprint 2 = Task 5–7; Sprint 3 = Task 8–10. Vòng lặp minh họa Sprint 1–2 tuần, Daily Scrum 15 phút/ngày.
- Burndown: cập nhật story points còn lại cuối mỗi ngày. Biểu đồ 10 ngày/20 điểm trong đề chỉ là ví dụ; không dùng làm số liệu thực tế của nhóm.
- DoD: code chạy và không lỗi build; đạt AC; commit rõ ràng và review trong nhóm; API validate; UI có loading/lỗi cơ bản; README hướng dẫn chạy.
- Bàn giao cuối Sprint: demo chọn sản phẩm → giỏ → thanh toán → xác nhận; mã nguồn Git, Compose chạy được, README; trình bày Retrospective; ghi phản hồi khách hàng/giảng viên vào backlog phiên bản sau.

## 5. API và thực thể tối thiểu (mục 12)

API: `GET /products`, `GET /products/:id`, `POST /auth/register`, `POST /auth/login`, `POST /orders`, `POST /payments` (idempotent), `GET /orders/me`.

| Thực thể | Trường tối thiểu trong đề |
|---|---|
| Product | id, name, price, imageUrl, stock |
| User | id, email, passwordHash, loyaltyPoints |
| Order | id, userId, status, total, createdAt |
| OrderItem | id, orderId, productId, size, qty, lineTotal |
| Payment | id, orderId, idempotencyKey, amount, method |

Đây là mô hình tối thiểu của đề, không phải schema Prisma đầy đủ hoặc yêu cầu đổi tên trường hiện tại. Hợp đồng ứng dụng tra tại `API_CONTRACT.md`.

## 6. Nội dung báo cáo nhóm cần giữ nhất quán

Báo cáo trang 1 ghi GVHD **Từ Lãng Phiêu** và sáu thành viên: Phạm Gia Khôi, Võ Minh Tri, Nguyễn Văn Đông, Lê Quang Điệp, Trần Thế Duy, Nguyễn Tuấn Kiệt. Không tự thêm MSSV còn thiếu.

Trang 2–5 chia Story như sau:

| Mã trong báo cáo nhóm | Nội dung | Phạm vi |
|---|---|---|
| US01 | Xem menu, dữ liệu sản phẩm và trạng thái tải/rỗng/lỗi | Bắt buộc |
| US02 | Chi tiết, tùy chỉnh hợp lệ, giá theo lựa chọn/số lượng | Bắt buộc |
| US03 | Thêm/sửa/xóa giỏ, phân biệt cấu hình, tổng/badge, chặn checkout giỏ rỗng | Bắt buộc |
| US04 | Register/login, từ chối email trùng, băm mật khẩu, bảo vệ đặt đơn | Bắt buộc |
| US05 | Tạo PENDING, server tính lại giá, kiểm tra hàng và rollback khi lỗi | Bắt buộc |
| US06 | Ví/Thẻ mock; server xác nhận PAID/FAILED; không báo thành công khi chưa rõ | Bắt buộc |
| US07 | Xác nhận từ server; reload không tạo đơn/payment mới | Bắt buộc |
| US08 | Lịch sử/trạng thái chỉ của chủ tài khoản, có tải/rỗng/lỗi | Bắt buộc |
| US09 | Cùng key/nội dung cho kết quả nhất quán; cùng key khác nội dung bị từ chối | Bắt buộc |
| US10 | Tồn kho không âm khi đồng thời; từ chối thiếu hàng và có test tranh chấp | Bắt buộc |
| US11 | Server kiểm tra mã giảm giá; tiền giảm nhất quán | Bắt buộc |
| US12 | Cộng điểm sau PAID, không cộng lặp, hiển thị điểm từ server | Bắt buộc |
| US13 | Kiểm soát vòng đời, chặn chuyển sai và cập nhật trạng thái kết thúc | Bắt buộc |
| US14 | Barista xem/tiếp nhận đơn đủ điều kiện, RBAC | Mở rộng |
| US15 | PREPARING → READY → COMPLETED, đồng bộ trạng thái khách | Mở rộng |
| US16 | Hủy hợp lệ có lý do, không tự tuyên bố hoàn tiền | Mở rộng |

**Không trộn mã:** Story thanh toán ví dụ trong đề mang mã `US-05`; báo cáo nhóm dùng `US06` cho thanh toán và `US05` cho tạo đơn. Mã Task 1–10 cũng khác mã User Story và khác Task 1–5 của Assignment 2.

Báo cáo trang 7 phân công nội dung biên soạn và review, không phải bằng chứng hoàn tất triển khai. Phần Barista ghi rõ Khôi phụ trách UI, Điệp rà soát nghiệp vụ/backend, Duy kiểm tra AC đồng bộ trạng thái phía khách. Phần Điệp liên quan tạo đơn US05, tồn kho US10, vòng đời US13 và phối hợp Barista. Không dùng phân công báo cáo để tự thay owner mã nguồn đã thống nhất trong repo. Bảng trang 7 bị lệch dòng khi trích xuất văn bản; cần kiểm tra trực quan bản PDF trước khi chép lại toàn bộ bảng phân công.

## 7. Các điểm phải đối chiếu khi viết báo cáo tiếp theo

- **Task 8:** đề yêu cầu lựa chọn Ví/Thẻ mock. Báo cáo nhóm trang 3, 8 xác định VNPAY_QR Sandbox hiện có chưa tự đáp ứng tiêu chí này. Trình bày VNPAY là khác biệt/mở rộng; không tự đánh dấu Task 8 hoàn tất hoặc suy ra giảng viên đã chấp thuận thay thế. Chưa sửa payment trong lượt ghi nhớ này.
- **Task 9:** phải có demo E2E phù hợp yêu cầu; trang UI, API riêng lẻ hoặc giao dịch Sandbox cũ không thay toàn bộ minh chứng bàn giao.
- **Task 10:** báo cáo trang 8 nêu vấn đề kiểm tra voucher/đổi điểm cần xử lý. Đây là nhận định tại mốc `2c45463`, **chưa được kiểm tra độc lập trong lượt này**; cần xác minh bằng code/test hiện hành trước khi khẳng định còn lỗi hoặc đã sửa.
- **Barista:** báo cáo trang 9 nói thiếu `GET /staff/orders/:id` tại mốc main đã đọc. Tài liệu repo hiện ghi nhánh `feature/orders-and-inventory` đã có endpoint này và giữ lại sau merge 26/10. Không chép nhận định thiếu endpoint thành hiện trạng; khi làm báo cáo phải kiểm tra đúng branch/commit và test.
- **Bằng chứng:** tách yêu cầu, code hiện có, test đã chạy, test bị skip và việc còn thiếu. Ghi ngày, commit/môi trường, mock/API/Sandbox và phạm vi của mỗi bằng chứng; không tự cộng điểm, dựng biên bản Scrum hoặc burndown giả.
- **NFR:** < 500 ms cần phép đo; kiểm tra vài viewport không chứng minh tương thích mọi trình duyệt.
- **Giới hạn runtime:** lượt này chỉ đọc và lưu tài liệu, không chạy build, ứng dụng, Docker, DB hoặc E2E. `PROJECT_STATUS.md` ghi mốc 26/10 Docker daemon không chạy và các DB test chưa chạy; đó là tình trạng được ghi trước đây, chưa kiểm tra lại ngày 27/10.

## 8. Checklist sử dụng khi soạn báo cáo

- [ ] Chốt đúng tài liệu/phiên bản và branch/commit đang báo cáo.
- [ ] Trình bày vision, stakeholder, phạm vi bắt buộc/mở rộng và FR/NFR.
- [ ] Dùng nhất quán US01–US16, AC kiểm chứng được, dẫn nguồn yêu cầu gốc.
- [ ] Đối chiếu đủ 10 task và bốn phần Task 10; giữ riêng khoảng trống Ví/Thẻ mock.
- [ ] Kiểm tra đường dẫn repo và phân công trước khi chép vào báo cáo.
- [ ] Bổ sung minh chứng Scrum, build/test, hiệu năng, browser, DB/Compose và E2E thực tế.
- [ ] Kết luận theo DoD; ghi blocker và backlog còn lại, không suy từ UI mock sang API hoàn thành.

Checklist này là gợi ý tổ chức báo cáo rút ra từ tài liệu, chưa phải danh sách công việc đã nghiệm thu hoặc yêu cầu bắt đầu triển khai Assignment 2.
