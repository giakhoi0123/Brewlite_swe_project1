# Điệp — Bộ bàn giao Task 1 Assignment 2

## Cập nhật Task 1.3 ngày 24/10/2026 — dùng phân công mới

Mở [đặc tả Đặt và thanh toán đơn hàng](../requirements/use-case-checkout.md) trước. Đây là bản bàn giao Task 1.3 theo hai file người dùng vừa cung cấp: `Assignment2-BrewLite (2).pdf` và `BrewLite_Phan_cong_6_thanh_vien.docx`. Điệp viết đặc tả, Duy phụ trách sơ đồ, Đông–Điệp kiểm tra chéo. Các phân công Khôi/Kiệt tổng hợp UC-CHK trong nội dung ngày 21/10 bên dưới là lịch sử, không phải owner Task 1.3 của bản này.

Bộ mới gồm đặc tả, [bản Word để đọc/ghép báo cáo](Task1.3_Dat_va_thanh_toan_don_hang.docx), [nguồn PlantUML](../diagrams/use-case-checkout-draft.puml), [SVG đề xuất](../diagrams/use-case-checkout-draft.svg), [PNG để chèn báo cáo](../diagrams/use-case-checkout-draft.png), quy tắc và 15 AC/test dự kiến. Markdown là nguồn nội dung; Word là bản xuất tại ngày 24/10, cần xuất lại nếu sửa Markdown. Duy cần review hình; Tri/Đông ghép mã yêu cầu vào SRS. Bảng truy vết mục 10 của đặc tả là nguồn mapping UC-CHK; mã FR-CHK là đề xuất cục bộ, không phải mã SRS đã phê duyệt. Các câu hỏi Q01–Q05 trong đặc tả mới độc lập với Q01–Q06 của bộ nháp cũ bên dưới.

Trạng thái **DRAFT_READY_FOR_REVIEW**. Không ghi nhận phê duyệt, commit/PR hoặc kết quả chạy ứng dụng khi chưa có bằng chứng.

Kiểm tra ngày 24/10: đọc UTF-8, kiểm liên kết tương đối trong đặc tả, định nghĩa/tham chiếu 10 bước chính + 4 luồng thay thế + 8 ngoại lệ + 8 quy tắc, 15 cặp AC/test duy nhất và mapping yêu cầu đều PASS. SVG phân tích XML hợp lệ, đã kết xuất PNG bằng Edge qua Playwright và xem ảnh; kiểm cấu trúc nguồn PlantUML, chưa chạy compiler PlantUML. Word đã mở lại bằng python-docx, đủ 12 bảng, 1 ảnh và toàn bộ 15 cặp AC/test; chưa kiểm dàn trang bằng Microsoft Word. `git diff --check` PASS. Không chạy build/unit/integration/E2E ứng dụng hay Docker/DB vì chỉ thay tài liệu; 15 ca CHK-T vẫn PLANNED.

## Bộ nháp ngày 21/10/2026 — giữ để tham khảo

Ngày soạn: 2026-10-21. Trạng thái: **DRAFT_READY_FOR_REVIEW**.

## 1. Mở các tài liệu theo thứ tự

1. [Yêu cầu Order, Inventory và Staff](../requirements/tv4-order-inventory-staff.md): bối cảnh, stakeholder, scope, giả định/rủi ro, 6 FR có AC, phần NFR, 4 User Story/Use Case, ma trận 49 cặp trạng thái và chính sách kho.
2. [Kế hoạch kiểm thử](../requirements/tv4-test-plan.md): dữ liệu đầu vào, thao tác, kết quả mong đợi và AC tương ứng cho từng test.
3. [Ma trận truy vết](../traceability-matrix.md): FR → US/UC → thiết kế dự kiến → API dự kiến → test dự kiến.

Đây là phần việc tài liệu của Điệp cho Task 1. Chưa có Use Case diagram tổng quát và sơ đồ phạm vi UC-CHK của nhóm; chưa thể coi Task 1 toàn nhóm hoàn thành chỉ với ba tài liệu trên. Các kế hoạch test chưa phải bằng chứng chạy test Assignment 2.

## 2. Những điểm cần nhóm review

| ID | Câu hỏi/khác biệt | Đề xuất để review | Người cần xác nhận | Trạng thái |
|---|---|---|---|---|
| Q01 | Báo cáo nhóm yêu cầu repo/code mới; đề chính thức chỉ nói tiếp tục đề tài và nghiệm thu tuần tự | Nhóm hỏi rõ giảng viên về tái sử dụng source và lịch sử nghiệm thu; giữ nguyên repo/branch hiện tại trong lúc chuẩn bị tài liệu | Khôi/giảng viên | OPEN |
| Q02 | DOCX cũ giao History cho Điệp, Workflow/Inventory cho TV6; báo cáo Assignment 2 giao Điệp Order/State/Inventory/Staff và Duy History | Dùng phân miền báo cáo Assignment 2 làm bản đề xuất: Điệp cung cấp dữ liệu/domain/contract, Duy sở hữu History/Tracking; chốt rõ owner GET /orders/me và customer detail/status | Khôi/Điệp/Duy | OPEN |
| Q03 | Giữ/hoàn kho và retry ảnh hưởng Catalog/Cart/Payment | Giữ khi PENDING; hoàn khi FAILED/CANCELLED đúng một lần; retry giữ lại trước gateway; UNKNOWN giữ reservation; stock theo Product | Điệp/Tri/Đông/Kiệt | OPEN — đã viết đề xuất |
| Q04 | Hủy trong khi Payment PROCESSING/UNKNOWN hoặc đang settle có nguy cơ kết quả thanh toán và đơn lệch nhau | Đề xuất chặn hủy 409 khi attempt chưa rõ; serialize claim/settle/cancel trên cùng Order và kiểm tra lại điều kiện sau khóa; đối soát cần owner Payment thiết kế. Không coi đây là hành vi đã được xác minh của code cũ | Điệp/Kiệt | OPEN — chặn chốt AC hủy tích hợp |
| Q05 | Phạm vi Barista, hủy PAID và reservation bị treo | Đề xuất Barista Should; hủy PAID chỉ sandbox, không refund thật; không tự hủy PREPARING; chưa đặt TTL. Khi nhóm cam kết Barista thì ghi rõ điều kiện nghiệm thu và cách xử lý đơn bị treo | Khôi/Điệp/Kiệt | OPEN |
| Q06 | Idempotency Payment không ngăn tạo hai Order khi POST /orders bị timeout rồi gửi lại | Giữ orderId khi đã nhận; chưa tự retry POST nếu chưa rõ kết quả. Nhóm chốt cơ chế đối soát hoặc idempotency riêng cho tạo đơn tại API design, không tuyên bố đã chống trùng Order nhờ Payment key | Điệp/Đông/Khôi/Kiệt | OPEN |

Các câu hỏi trên không ngăn việc soạn phần yêu cầu đã biết. Quyết định ảnh hưởng AC phải được cập nhật và review trước khi coi baseline Task 1 đã duyệt. Không ghi tên reviewer, thời gian phê duyệt hoặc link PR giả.

## 3. Nội dung PR đã chuẩn bị để dùng sau khi chốt repo

Tiêu đề đề xuất: `docs(task1): đặc tả Order, Inventory và Staff cho Assignment 2`.

Mô tả đề xuất:

> Bổ sung bản yêu cầu miền TV4 với FR-05/08/10/14/15/16, acceptance criteria, User Story/Use Case, state matrix và chính sách giữ/hoàn kho. Bổ sung test plan và truy vết dự kiến để các Task thiết kế/triển khai có tiêu chí nghiệm thu. Đề nghị review các điểm Q01–Q06 trong hồ sơ bàn giao, đặc biệt ownership History và hủy khi Payment chưa rõ kết quả. Tài liệu đang ở trạng thái draft; chưa dùng test/commit Assignment 1 làm evidence Assignment 2.

Người review đề xuất: Khôi cho scope/mã/ưu tiên; Kiệt cho Payment–Order; Tri/Đông cho stock và giá; Duy cho History/truy vết. Chưa tạo commit/PR hoặc gửi thông báo bên ngoài trong lượt soạn này.

## 4. Checklist trước khi chuyển Task 2

- [x] Có bản yêu cầu phần TV4 với AC, User Story và UC văn bản.
- [x] Có ma trận trạng thái, chính sách kho và các boundary cần phối hợp.
- [x] Có test plan và ma trận truy vết dự kiến.
- [ ] Nhóm xác nhận Q01–Q06 và đồng bộ các AC bị ảnh hưởng.
- [ ] Khôi tổng hợp `docs/requirements/context-and-scope.md` và `srs.md` toàn hệ thống; chốt mã/ưu tiên chung.
- [ ] Khôi/Kiệt tổng hợp `use-case-checkout.md`, Use Case diagram tổng quát và diagram phạm vi Checkout; Điệp review bước tạo đơn/kho.
- [ ] Đưa tài liệu vào repository được nhóm chọn, commit/PR thật, review/merge và lưu link.
- [ ] Task 1 toàn nhóm có đủ tạo phẩm trước nghiệm thu Task 2.

Sau khi Task 1 được duyệt, Điệp thực hiện phần Orders/Stock trong Sequence/Class và Activity Barista; luôn lưu cả source và hình kết xuất. Backend/ADR/CI/CD thuộc các Task sau.

## 5. Tình trạng kiểm chứng lượt soạn

Phạm vi lượt này là Markdown. Đã chạy kiểm tra đọc file bằng Node.js: 4 tài liệu mới, 11 liên kết tương đối tồn tại, 24 AC có định nghĩa duy nhất và đều được ánh xạ trong 26 test dự kiến; không có tham chiếu AC/test không xác định. Đã đối chiếu đủ 49 cặp của ma trận với state machine tham khảo hiện tại: 9 cạnh hợp lệ, 40 cặp bị từ chối. Kiểm tra khoảng trắng ở file mới và `git diff --check` đều PASS. Đây là kiểm tra cấu trúc/nhất quán tài liệu, không thay review nghiệp vụ của nhóm.

Không thay ứng dụng, không chạy lại build/unit/integration/E2E, không kiểm tra Docker/DB; vì vậy không có kết luận mới về môi trường hoặc kết quả chạy hệ thống. Kết quả kiểm chứng mã cũ nằm trong các tài liệu Assignment 1 và không được nâng thành trạng thái Assignment 2.
