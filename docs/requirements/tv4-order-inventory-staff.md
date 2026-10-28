# Assignment 2 — Task 1: Order, Inventory và Staff

Người phụ trách: **Lê Quang Điệp — TV4 — 3124410071**. Ngày soạn: 2026-10-21.

Trạng thái: **DRAFT_READY_FOR_REVIEW** — bản đóng góp của TV4, chưa phải SRS toàn hệ thống đã được nhóm duyệt. Các acceptance criteria bên dưới là yêu cầu để kiểm thử sau này, không phải kết quả test.

## 1. Cơ sở và cách sử dụng

- Đề `Assignment2-BrewLite (1).pdf`, mục 3: Task 1 cần bối cảnh/phạm vi, FR/NFR có MoSCoW và acceptance criteria, Use Case tổng quát và đặc tả một Use Case trọng tâm.
- Báo cáo `BrewLite (1).pdf`, mục 7 và 9.1–9.6: Điệp phụ trách Order, State Machine, Inventory/Concurrency và backend Barista. Mã FR/US dùng theo bản báo cáo này.
- File `Phân việc SWE-Brewlite (5).docx` là phân công cũ; History và Inventory có owner khác so với báo cáo Assignment 2. Các điểm này được ghi trong [hồ sơ bàn giao](../assignment2/TV4_TASK1_HANDOFF.md).
- [API contract hiện có](../API_CONTRACT.md), đặc biệt các mục Payment consistency và Orders/Staff, cùng state machine trong repo Assignment 1 là nguồn tham khảo hành vi. Các ghi chú lịch sử về retry trong contract có khác nhau; bản này đề xuất giữ kho **trước** khi bắt đầu lần thanh toán lại, theo mục cập nhật Payment consistency.

Đề chính thức xác định yêu cầu chấm; báo cáo nhóm xác định phạm vi nhóm đề xuất. Việc bắt buộc viết lại toàn bộ code là quy ước trong báo cáo nhóm, chưa được xác nhận là yêu cầu giảng viên. Bản này không coi commit/test Assignment 1 là minh chứng triển khai Assignment 2.

Trưởng nhóm ghép nội dung được duyệt vào `docs/requirements/context-and-scope.md`, `srs.md` và `use-case-checkout.md` của hồ sơ chung. Các tệp chung này chưa được tạo trong lượt TV4 để tránh trình bày phần riêng như hồ sơ đầy đủ của cả nhóm. Các UC có tiền tố `UC-TV4-` là mã đóng góp cục bộ, cần được ánh xạ khi tổng hợp.

## 2. Bối cảnh, stakeholder và phạm vi

Khách cần đơn ghi đúng cấu hình và giá đồ uống; cửa hàng cần tránh nhận quá số lượng còn bán được. Nhân viên cần biết đơn nào đã thanh toán và cập nhật đúng tiến trình, kể cả khi nhiều thao tác xảy ra đồng thời.

| Stakeholder | Nhu cầu/kỳ vọng trong miền TV4 | Tiêu chí giá trị |
|---|---|---|
| Khách hàng | Tạo đơn đúng món, giá và trạng thái | Nhận mã đơn PENDING; không bị báo thành công khi hết hàng; chỉ đọc đơn của mình |
| Barista/nhân viên quầy | Nhận đúng đơn đã trả tiền, biết việc cần làm | Hàng chờ PAID; không nhảy bước hoặc tự xác nhận thanh toán |
| Quản lý cửa hàng | Tồn kho và lịch sử trạng thái đáng tin | Không âm kho; mỗi chuyển trạng thái có dấu thời gian; hủy có lý do |
| Giảng viên/người nghiệm thu | Kiểm chứng được yêu cầu | FR có acceptance criteria, test ID và đường dẫn truy vết |
| Nhóm phát triển | Contract và owner rõ | Order, Payment, History, Catalog tích hợp qua interface được review |
| Đơn vị thanh toán, được mô phỏng bằng gateway | Kết quả thanh toán được xử lý nhất quán | Payment owner xác minh kết quả; Order không tự suy ra PAID từ lỗi mạng |

Quản lý và giảng viên là stakeholder, không mặc nhiên là actor có tài khoản quản trị trong sản phẩm.

| Loại phạm vi | Nội dung |
|---|---|
| In-scope TV4, cốt lõi | Tạo Order/OrderItem PENDING; giá server và snapshot; state machine; transaction và giữ/hoàn tồn kho; contract tích hợp Payment |
| Mở rộng nhóm đề xuất | Staff list/detail, tiếp nhận/pha chế/bàn giao, hủy có lý do, dữ liệu phục vụ giao diện Barista |
| Phối hợp owner khác | Khôi: Auth/RBAC, UI; Tri: Product/giá/seed; Đông: tùy chọn/Cart; Kiệt: Payment/idempotency; Duy: History/Tracking/Promotion/Loyalty và E2E |
| Out-of-scope TV4 | Xây lại Auth, UI, gateway Payment, tính khuyến mãi/điểm, vận hành production; sửa trực tiếp module owner khác |
| Ngoài sản phẩm đề xuất | Thu/hoàn tiền thật, giao hàng tận nơi, quản lý nguyên liệu theo công thức, ERP/đa chi nhánh |

### Giả định, ràng buộc và rủi ro

1. Next.js, NestJS và PostgreSQL là công nghệ bắt buộc của đề; Auth được xác thực bằng backend thật. Payment dùng gateway mô phỏng.
2. Đề xuất một đơn vị stock cho một ly theo Product; các size/topping của cùng Product dùng chung stock. Tri và Đông cần xác nhận; chưa quản lý kho nguyên liệu/topping riêng.
3. Tiền lưu bằng số nguyên VND; tổng tiền được tính từ dữ liệu server. Catalog cung cấp giá và tùy chọn hợp lệ; Promotion cung cấp mức giảm hợp lệ nếu có.
4. Backend lấy user/role từ phiên xác thực. Customer chỉ tạo/đọc đơn của mình; staff cần BARISTA.
5. Timeout mạng không chứng minh Payment thất bại. UNKNOWN không phải trạng thái Order; đề xuất giữ kho và chờ xác minh kết quả.
6. Đơn PENDING bị bỏ quên có thể giữ kho lâu. Chưa có thời gian hết hạn hoặc job tự giải phóng được nhóm duyệt; ghi nhận rủi ro, không tự đặt TTL.
7. Chính sách hủy PAID trong sandbox không phải hoàn tiền. Hủy trong lúc Payment PROCESSING/UNKNOWN cần review chung trước nghiệm thu tích hợp.
8. Các mã lỗi, giới hạn dữ liệu và chính sách dưới đây kế thừa contract tham khảo; nhóm cần duyệt khi chốt API Task 3.

## 3. Yêu cầu chức năng và acceptance criteria

Ưu tiên **Must** dưới đây áp dụng cho phạm vi cốt lõi mà nhóm đề xuất, không khẳng định mọi chi tiết đều được đề chính thức chỉ định. Barista được đề xuất **Should** vì là mở rộng; nếu nhóm cam kết đưa vào phạm vi bàn giao thì vẫn phải nghiệm thu đủ tiêu chí. Không tự hạ phạm vi đã cam kết nếu chưa review.

### FR-05 — Tạo đơn hàng — Must

- **AC-05-01:** CUSTOMER có phiên hợp lệ và giỏ hợp lệ nhận HTTP 201, mã đơn duy nhất và trạng thái PENDING. Order, items, snapshot giá, bản ghi lịch sử ban đầu và giữ kho được commit cùng transaction. Chưa xóa giỏ hoặc cấp điểm ở bước này.
- **AC-05-02:** Thiếu/sai/hết hạn JWT trả 401; BARISTA gọi API tạo đơn dành cho CUSTOMER trả 403. Không có Order hoặc thay đổi kho từ request bị từ chối.
- **AC-05-03:** Giỏ phải có 1–100 dòng, quantity nguyên 1–99; UUID, size, topping, ice/sugar phải hợp lệ; topping không lặp; note tối đa 120 ký tự. Giỏ rỗng, cấu hình không thuộc Product hoặc field ngoài DTO trả 400 và không ghi dữ liệu nghiệp vụ.
- **AC-05-04:** Client chỉ gửi cấu hình món và promotionCode nếu có; gửi trường tự đặt giá/amount/total/userId/status bị từ chối 400. Backend tính `unitPrice = giá Product + phụ thu size + tổng phụ thu topping`; `subtotal = tổng unitPrice × quantity`; `total = subtotal − discount hợp lệ`. Không tràn kiểu số lưu trữ, total không âm.
- **AC-05-05:** Snapshot tên món, cấu hình, đơn giá và tổng tiền của đơn không bị thay đổi khi Catalog đổi giá/tên. Retry thanh toán dùng snapshot đơn cũ.
- **AC-05-06:** Nếu lỗi sau khi giữ một phần kho hoặc ghi một phần items, toàn transaction rollback; số Order/items/history và stock trở về trước request.

### FR-08 — Quản lý trạng thái đơn — Must

- **AC-08-01:** Chỉ chấp nhận các cạnh trong ma trận ở mục 5. Chuyển trái phép hoặc lặp cùng trạng thái trả 409 tại lớp nghiệp vụ; không ghi thêm history hoặc tác động kho.
- **AC-08-02:** Mỗi chuyển hợp lệ cập nhật status, version, lịch sử from/to/thời điểm và tác động kho liên quan trong một transaction. Hai request cùng dựa trên một version không được cùng ghi thành công.
- **AC-08-03:** Chỉ Payment service đã xác minh kết quả mới yêu cầu PAID/PAYMENT_FAILED. CUSTOMER và BARISTA không có quyền đặt hai trạng thái này bằng payload công khai. UNKNOWN không tạo transition, không cấp điểm và không giải phóng kho.
- **AC-08-04:** COMPLETED/CANCELLED là terminal. READY → COMPLETED ghi completedAt bằng thời điểm sự kiện hoàn tất; request lặp không ghi đè thời điểm đó.

### FR-10 — Tồn kho và xử lý đồng thời — Must

- **AC-10-01:** Khi tạo PENDING, cộng quantity của mọi dòng cùng Product trước khi kiểm tra/giữ kho. Stock không âm; thiếu kho hoặc xung đột cập nhật trả 409 và rollback toàn đơn.
- **AC-10-02:** Với stock ban đầu 1, hai khách đồng thời đặt một ly: đúng một đơn được tạo, request còn lại bị từ chối 409, stock cuối bằng 0. Dùng transaction và kiểm tra version hoặc cơ chế tương đương được ADR phê duyệt.
- **AC-10-03:** PAYMENT_FAILED/CANCELLED hoàn đúng lượng đã giữ, tối đa một lần. Hủy một đơn PAYMENT_FAILED đã hoàn kho không tăng stock lần nữa.
- **AC-10-04:** Retry từ PAYMENT_FAILED giữ lại kho và chuyển PENDING trong transaction chuẩn bị payment attempt, trước khi gọi gateway. Thiếu kho trả 409, giữ PAYMENT_FAILED; không tạo attempt mới đã commit và không gọi gateway.
- **AC-10-05:** PAID/PREPARING/READY/COMPLETED không trừ thêm kho. UNKNOWN giữ nguyên reservation; replay kết quả Payment không giữ/hoàn kho thêm.

### FR-14 — Barista xem đơn — Should

- **AC-14-01:** Chỉ BARISTA đọc được Staff list/detail. Không có phiên trả 401; CUSTOMER trả 403. Response không có password hash, token hoặc email không cần thiết.
- **AC-14-02:** Hàng chờ chỉ hiển thị PAID; không đưa PENDING/PAYMENT_FAILED vào hàng pha chế. Đề xuất API danh sách trả PAID/PREPARING/READY/COMPLETED/CANCELLED để UI lọc queue/history, thứ tự createdAt tăng dần rồi id tăng dần.
- **AC-14-03:** Detail trả mã đơn, snapshot món, số lượng, tùy chọn/ghi chú, tổng tiền, trạng thái và dữ liệu thời gian liên quan; UUID sai trả 400, đơn không tồn tại trả 404. BARISTA có thể đọc detail PENDING/PAYMENT_FAILED để xử lý hủy dù không có trong queue.

### FR-15 — Barista cập nhật tiến trình — Should

- **AC-15-01:** BARISTA chỉ thực hiện PAID → PREPARING → READY → COMPLETED; mỗi bước trả trạng thái backend mới nhất. Không bỏ qua bước hoặc thao tác sau terminal.
- **AC-15-02:** Endpoint status chỉ nhận PREPARING/READY/COMPLETED. Payload PAID/PENDING/PAYMENT_FAILED/CANCELLED trả 400; đích đúng enum nhưng sai trạng thái nguồn trả 409. Hủy đi qua endpoint riêng có lý do.
- **AC-15-03:** Hai thao tác bàn giao đồng thời trên một đơn READY tạo đúng một sự kiện COMPLETED; một request thành công, request còn lại 409. Khi tải lại đơn qua API của chủ đơn, kết quả khớp trạng thái và completedAt đã lưu. Cơ chế polling/realtime do UI/History owner chốt ở Task 3.

### FR-16 — Hủy đơn có lý do — Should

- **AC-16-01:** BARISTA được yêu cầu hủy từ PENDING/PAID/PAYMENT_FAILED, với lý do sau trim dài 1–300 ký tự. Reason rỗng/quá dài trả 400; PREPARING/READY/COMPLETED/CANCELLED trả 409. Điều kiện an toàn với Payment đang xử lý còn chờ Q04 được duyệt.
- **AC-16-02:** Hủy thành công cập nhật CANCELLED, cancelReason, version, history và hoàn kho nếu còn giữ trong cùng transaction. Hủy lặp trả 409; không sửa lý do cũ/hoàn kho lần hai. Lỗi giữa chừng rollback tất cả.
- **AC-16-03:** Hủy PAID không được trả thông báo hoặc trường dữ liệu khẳng định đã hoàn tiền. Không thực hiện refund thật trong phạm vi này.

## 4. Đóng góp NFR và ranh giới phối hợp

| Mã/ưu tiên | Tiêu chí của miền TV4 | Cách kiểm chứng |
|---|---|---|
| NFR-02 / Must — Bảo mật | JWT và role từ backend; không cho CUSTOMER dùng Staff API; không đọc đơn người khác; reject field giả mạo; không trả bí mật trong DTO | Test 401/403/404 và payload sai; kiểm response; phối hợp Auth/History owner |
| NFR-04 / Must — Toàn vẹn | Stock ≥ 0, commit/rollback nguyên tử, không hoàn kho lặp, không ghi đè transition khi race, không áp Payment replay lần hai | Unit tất cả 49 cặp trạng thái và integration PostgreSQL thật theo test plan |

Hiệu năng, tính khả dụng, mobile-first và khả năng triển khai vẫn phải có trong SRS toàn hệ thống theo đề. TV4 cung cấp dữ liệu/contract; Khôi và Duy tổng hợp ngưỡng đo, môi trường và tiêu chí nghiệm thu. Bản đóng góp này chưa bao phủ toàn bộ NFR của nhóm.

## 5. Ma trận trạng thái và thẩm quyền

`Y` = cạnh hợp lệ về nghiệp vụ, còn phải kiểm quyền, dữ liệu và điều kiện Payment; `—` = từ chối. Ma trận có 7 × 7 = 49 cặp, trong đó 9 cạnh hợp lệ.

| Từ / Sang | PENDING | PAID | PAYMENT_FAILED | PREPARING | READY | COMPLETED | CANCELLED |
|---|---|---|---|---|---|---|---|
| PENDING | — | Y | Y | — | — | — | Y |
| PAID | — | — | — | Y | — | — | Y |
| PAYMENT_FAILED | Y | — | — | — | — | — | Y |
| PREPARING | — | — | — | — | Y | — | — |
| READY | — | — | — | — | — | Y | — |
| COMPLETED | — | — | — | — | — | — | — |
| CANCELLED | — | — | — | — | — | — | — |

| Transition | Thành phần có quyền yêu cầu | Tác động kho |
|---|---|---|
| Tạo mới → PENDING | CUSTOMER qua Orders API | Giữ kho một lần |
| PENDING → PAID | Payment service, kết quả đã xác minh | Giữ nguyên |
| PENDING → PAYMENT_FAILED | Payment service, thất bại đã xác định | Hoàn reservation một lần |
| PAYMENT_FAILED → PENDING | Payment service khi chuẩn bị retry | Giữ lại; thất bại thì rollback |
| PAID → PREPARING → READY → COMPLETED | BARISTA qua Staff API | Không trừ thêm; không hoàn lúc giao |
| PENDING/PAID/PAYMENT_FAILED → CANCELLED | BARISTA qua API hủy có lý do | Hoàn nếu còn giữ |

Đề xuất chưa cung cấp endpoint để CUSTOMER tự hủy. State machine không thay thế authorization. Không chuyển PAYMENT_FAILED trực tiếp sang PAID; retry phải qua PENDING. Idempotency nằm ở Payment: replay đã xử lý trả kết quả cũ trước khi gọi state machine, không nới ma trận để chấp nhận transition lặp.

## 6. Chính sách tồn kho đề xuất

Stock là số lượng còn có thể nhận đơn. Khi giữ kho, giảm stock và đánh dấu reservation của đơn (`inventoryHeld` hoặc cơ chế tương đương); mỗi ly chỉ giảm một lần dù đi qua nhiều trạng thái. Hoàn kho đồng thời xóa dấu reservation để không hoàn lặp. Dùng snapshot quantity để hoàn đúng sản phẩm/số lượng.

Ví dụ stock 5, đơn A mua 2 ly: tạo PENDING còn 3; Payment thất bại trả về 5; retry giữ lại còn 3; PAID rồi COMPLETED vẫn còn 3. Nếu hủy khi PAYMENT_FAILED, stock vẫn 5. Nếu kết quả UNKNOWN khi đang PENDING, stock vẫn 3 và không tự tạo lần thanh toán khác.

Nhiều dòng cùng Product nhưng khác size/topping phải cộng số lượng trước khi giữ kho. Đơn nhiều Product phải thành công hoặc thất bại toàn bộ. Tránh giữ transaction DB mở khi chờ gateway; phối hợp Payment owner để claim/settle và cập nhật Order an toàn. Khi lỗi mạng sau POST /orders, UI không được coi idempotency Payment là cơ chế chống trùng tạo đơn; xử lý retry tạo đơn là điểm Q06 cần thống nhất.

## 7. User Story và đặc tả Use Case đóng góp

### US-05 / UC-TV4-ORDER — Tạo đơn hàng

**User Story:** Là khách hàng đã đăng nhập, tôi muốn tạo đơn từ giỏ để cửa hàng ghi nhận đúng món, cấu hình và giá chính thức trước khi thanh toán.

- Actor chính: CUSTOMER. Thành phần phối hợp: Catalog, Inventory, Promotion khi có mã.
- Trigger: khách xác nhận đặt đơn ở Checkout.
- Tiền điều kiện: phiên CUSTOMER hợp lệ; giỏ có món; Product/Option có dữ liệu server.
- Hậu điều kiện thành công: có Order PENDING, items/snapshot/history và reservation đã commit; trả mã đơn/tổng tiền. Chưa khẳng định thanh toán thành công.
- Hậu điều kiện thất bại: request không để lại ghi dữ liệu nghiệp vụ dở dang; giỏ còn để sửa/thử lại có kiểm soát.
- Luồng chính: (1) UI gửi cấu hình món; (2) API xác thực/validate; (3) server tính giá/kiểm mã giảm nếu có; (4) transaction giữ kho, tạo Order/items/history; (5) commit, trả 201; (6) UI bàn giao orderId cho bước Payment thuộc UC-CHK.
- Luồng thay thế: chưa đăng nhập thì đăng nhập rồi quay lại Checkout, giữ giỏ; mã ưu đãi sai thì báo lỗi cho khách sửa; khác cấu hình cùng Product vẫn là các dòng riêng nhưng gộp quantity để giữ kho.
- Ngoại lệ: dữ liệu sai 400, không có phiên 401, sai role 403, thiếu kho/xung đột 409; lỗi lưu DB rollback. Timeout HTTP không tự chứng minh Order chưa được tạo — xem Q06.
- FR/AC: FR-05, FR-10; AC-05-01 đến AC-05-06 và AC-10-01/02.
- Test: INT-ORD-01 đến INT-ORD-06; INT-STOCK-01/02.

UC này là phần tạo đơn của UC-CHK toàn nhóm. Khôi/Kiệt tổng hợp các bước Payment, idempotency, kết quả và sơ đồ Use Case trọng tâm; TV4 review điểm giao Order/Inventory.

### US-10 / UC-TV4-QUEUE — Xem hàng đợi và chi tiết

**User Story:** Là Barista, tôi muốn xem các đơn đã thanh toán cùng cấu hình món để chuẩn bị đúng yêu cầu khách hàng.

- Actor: BARISTA. Trigger: mở hàng chờ/chọn ticket.
- Tiền điều kiện: đăng nhập BARISTA. Hậu điều kiện: đọc đúng dữ liệu, không thay trạng thái/kho.
- Luồng chính: xác thực → lấy Staff list → UI lọc PAID → chọn đơn → đọc detail/snapshot.
- Thay thế: hàng chờ rỗng hiển thị empty; có thể mở detail đơn ngoài queue khi xử lý sự cố.
- Ngoại lệ: 401 yêu cầu đăng nhập; 403 không đủ quyền; UUID sai 400; đơn không tồn tại 404; API lỗi hiển thị lỗi và cho tải lại, không tự sinh đơn mock.
- FR/AC: FR-14, AC-14-01/02/03; phối hợp NFR-02.
- Test: API-STAFF-01/02/03, E2E-TV4-01.

### US-11 / UC-TV4-PROGRESS — Cập nhật pha chế/bàn giao

**User Story:** Là Barista, tôi muốn cập nhật tiến trình đơn để quầy và khách hàng biết món đang pha, đã sẵn sàng hoặc đã giao.

- Actor: BARISTA. Trigger: bấm nhận pha/pha xong/đã giao.
- Tiền điều kiện: role hợp lệ, đơn ở đúng trạng thái nguồn.
- Hậu điều kiện: status/version/history cùng commit; completedAt được ghi khi giao; kho không bị trừ thêm.
- Luồng chính: gửi trạng thái đích → kiểm quyền và cạnh transition → cập nhật nguyên tử → trả đơn mới → UI hiển thị kết quả backend.
- Thay thế: khách tải lại trang theo dõi và nhận trạng thái mới từ API của chủ đơn.
- Ngoại lệ: đích không được phép qua Staff API 400; thiếu phiên/sai role 401/403; đơn không tồn tại 404; sai bước hoặc thua race 409, UI tải lại trạng thái trước khi cho thao tác tiếp.
- FR/AC: FR-08, FR-15, AC-10-05.
- Test: UNIT-STATE-01, INT-STATE-01, INT-STAFF-01/02, E2E-TV4-01.

### US-12 / UC-TV4-CANCEL — Hủy đơn có lý do

**User Story:** Là Barista, tôi muốn hủy đơn theo điều kiện cho phép và ghi lý do để quầy xử lý sự cố và tồn kho được hoàn đúng.

- Actor: BARISTA. Trigger: xác nhận hủy trong giao diện xử lý sự cố.
- Tiền điều kiện: nguồn PENDING/PAID/PAYMENT_FAILED, lý do hợp lệ; điều kiện Payment in-flight chờ Q04.
- Hậu điều kiện: CANCELLED, lý do và history được lưu; reservation còn giữ được hoàn đúng một lần.
- Luồng chính: nhập lý do → API kiểm role/dữ liệu/trạng thái → transaction cập nhật trạng thái/lý do/kho/history → trả kết quả → UI cập nhật.
- Thay thế: đóng hộp thoại trước xác nhận không gửi mutation; hủy PAYMENT_FAILED đã hoàn kho không tác động kho thêm.
- Ngoại lệ: lý do sai 400; sai quyền 401/403; không tồn tại 404; sai trạng thái hoặc hủy lặp 409; lỗi DB rollback. Hủy PAID không thông báo đã refund.
- FR/AC: FR-16, AC-08-01/02, AC-10-03.
- Test: INT-CANCEL-01/02/03; INT-STOCK-04; INT-PAY-BOUNDARY-03 sau khi chốt Q04.

## 8. Điều kiện bàn giao phần TV4

- Có đủ FR, AC, User Story/UC và chính sách như trên; [test plan](tv4-test-plan.md) và [truy vết](../traceability-matrix.md) dùng cùng mã.
- Nhóm review owner/ưu tiên và các câu hỏi trong [hồ sơ bàn giao](../assignment2/TV4_TASK1_HANDOFF.md); ghi người duyệt và quyết định thật vào PR.
- Khôi tổng hợp context/scope, toàn bộ FR/NFR, Use Case tổng quát; Khôi/Kiệt tổng hợp UC-CHK và sơ đồ phạm vi. Phần này chưa được thay thế bằng các UC văn bản của TV4.
- Task 1 toàn nhóm chỉ nghiệm thu khi đầy đủ tạo phẩm đề yêu cầu và lịch sử Git/PR thật. Không dùng nhãn VERIFIED_COMPLETE cho bản đóng góp chưa review.
