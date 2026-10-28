# Assignment 2 — Kế hoạch kiểm thử yêu cầu TV4

Owner: Lê Quang Điệp. Ngày: 2026-10-21. Trạng thái tất cả ca: **PLANNED — chưa chạy để nghiệm thu Assignment 2**.

Nguồn acceptance criteria: [đặc tả TV4](tv4-order-inventory-staff.md). Test ID là kế hoạch, chưa phải file test hoặc bằng chứng PASS. Mã test có tiền tố TV4 trong các ca E2E để không trùng E2E chung; các mã khác cần Duy kiểm tra khi tổng hợp.

## 1. Ca kiểm thử

| ID / mức | AC được kiểm | Dữ liệu và thao tác | Kết quả phải quan sát |
|---|---|---|---|
| INT-ORD-01 / Integration | AC-05-01 | CUSTOMER có phiên; Product giá 30.000, size +5.000, topping +3.000, quantity 2, không mã giảm; tạo đơn | 201/PENDING, subtotal=total=76.000; Order/items/history/reservation commit cùng nhau; chưa Payment/điểm và chưa xóa giỏ |
| INT-ORD-02 / HTTP integration | AC-05-02 | Gửi cùng request lần lượt không JWT, JWT sai/hết hạn và phiên BARISTA | 401/401/401/403; Order và stock không đổi |
| INT-ORD-03 / HTTP integration | AC-05-03 | Tham số hóa giỏ 0/101 dòng, qty 0/100/lẻ, UUID sai, size sai, topping lặp/không thuộc món, ice/sugar sai, note 121 ký tự; kiểm thêm biên hợp lệ | Dữ liệu sai 400, không ghi DB; 1/100 dòng, qty 1/99 và note 120 vẫn được xử lý nếu các điều kiện khác hợp lệ |
| INT-ORD-04 / Integration | AC-05-04; NFR-02 | Chèn price/amount/total/userId/status; thử tổng vượt giới hạn và mã giảm không hợp lệ với owner Promotion | Field ngoài DTO và giá trị không hợp lệ bị từ chối; không có ghi DB; request hợp lệ tính theo giá server, total không âm/tràn số |
| INT-ORD-05 / Integration | AC-05-05 | Tạo đơn rồi đổi giá/tên Catalog; đọc lại đơn và retry thanh toán sau thất bại | Snapshot món, đơn giá và tổng đơn cũ giữ nguyên |
| INT-ORD-06 / Integration PostgreSQL | AC-05-06 | Gây lỗi tại bước ghi item/history sau khi reserve | Không còn Order/items/history của request; stock từng Product khôi phục đúng |
| INT-STOCK-01 / Integration PostgreSQL | AC-10-01 | Stock 2, hai dòng cùng Product khác size, mỗi dòng qty 2; thêm ca nhiều món trong đó món cuối hết | 409, rollback toàn bộ, không bỏ sót tổng quantity hoặc để lại reservation của món đầu |
| INT-STOCK-02 / Concurrency PostgreSQL | AC-10-02 | Stock 1, hai CUSTOMER gửi đồng thời qua hai request/connection riêng | Chính xác một 201 và một 409; một Order, stock 0; không âm kho |
| INT-STOCK-03 / Integration | AC-10-04 | Đơn PAYMENT_FAILED; thử retry khi đủ kho và khi hết kho | Đủ kho: PENDING và reservation/claim nguyên tử trước gateway; hết kho: 409, vẫn FAILED, không attempt mới commit, gateway không được gọi |
| INT-STOCK-04 / Integration | AC-10-03; AC-16-02 | Tạo đơn, Payment failed hoàn kho, sau đó staff hủy; gửi lặp hủy | Kho trở về ban đầu đúng một lần; lần hủy lặp 409, không tăng stock/lý do/history |
| INT-STOCK-05 / Integration | AC-10-05; AC-08-03 | Từ PENDING: Payment UNKNOWN, replay; trên đơn khác PAID rồi PREPARING/READY/COMPLETED | UNKNOWN giữ status/version/history/kho; replay không tác động thêm; đường thành công chỉ trừ kho ban đầu |
| UNIT-STATE-01 / Unit | AC-08-01/04 | Duyệt 49 cặp trạng thái theo ma trận yêu cầu | 9 cạnh được chấp nhận, 40 cặp bị từ chối; terminal và self-transition bị chặn |
| INT-STATE-01 / Integration PostgreSQL | AC-08-02 | Gây lỗi khi ghi history của một transition hợp lệ; thử cập nhật từ version cũ | Status/version/history/kho rollback cùng nhau khi lỗi; cập nhật stale bị từ chối |
| API-STAFF-01 / HTTP integration | AC-14-01; NFR-02 | Không phiên/CUSTOMER/BARISTA gọi list, detail, status, cancel; kiểm DTO response | 401/403 với quyền thiếu/sai; BARISTA được xử lý theo nghiệp vụ; response không lộ password hash/token/email thừa |
| API-STAFF-02 / Integration | AC-14-02 | Seed đơn thuộc cả 7 trạng thái và hai đơn cùng createdAt | API chỉ trả tập trạng thái quy định, đúng thứ tự; UI queue chỉ PAID; dữ liệu rỗng trả danh sách rỗng |
| API-STAFF-03 / HTTP integration | AC-14-03 | Detail tồn tại ở từng trạng thái; UUID sai và UUID không tồn tại | Đúng snapshot/ghi chú/tổng/trạng thái; lỗi 400/404 tương ứng |
| INT-STAFF-01 / HTTP integration | AC-15-01/02; AC-08-03 | BARISTA đi đủ chuỗi; gửi PAID/PENDING/PAYMENT_FAILED/CANCELLED; thử bỏ bước | Chuỗi đúng cập nhật backend; field đích cấm 400; nhảy bước 409; không tự xác nhận thanh toán |
| INT-STAFF-02 / Concurrency PostgreSQL | AC-15-03; AC-08-04 | Hai BARISTA đồng thời yêu cầu READY → COMPLETED rồi đọc đơn bằng phiên chủ đơn | Một thành công, một 409; một event COMPLETED; completedAt không bị ghi đè; API khách khớp |
| INT-CANCEL-01 / HTTP integration | AC-16-01 | Reason rỗng, toàn khoảng trắng, 301 ký tự; thử biên 1/300; tham số hóa cả 7 trạng thái, Payment không in-flight | Reason sai 400; nguồn cấm 409; nguồn hợp lệ hủy được và reason trim đúng |
| INT-CANCEL-02 / Integration PostgreSQL | AC-16-02 | Gây lỗi ghi history sau cập nhật reason/kho trong hủy | Rollback status/version/reason/history/stock và reservation |
| INT-CANCEL-03 / Integration | AC-16-03 | Hủy đơn PAID trong sandbox | Đơn CANCELLED và hoàn kho đúng; response không khẳng định refund tiền; phối hợp UI kiểm thông báo |
| INT-PAY-BOUNDARY-01 / Integration phối hợp Kiệt | AC-08-03; AC-10-05 | Gửi lại cùng idempotency key đã PAID, rồi key mới khi attempt UNKNOWN | Replay không gọi transition/cấp điểm/giữ kho lần hai; UNKNOWN không cho thanh toán mới vượt khóa |
| INT-PAY-BOUNDARY-02 / Integration phối hợp Kiệt | AC-08-02; NFR-04 | Gây lỗi giữa finalize Payment và cập nhật Order/điểm | Không commit một kết quả thành công dang dở; thực hiện theo transaction contract Task 3 |
| INT-PAY-BOUNDARY-03 / Concurrency phối hợp Kiệt | AC-16-01; NFR-04 | Hủy đồng thời với claim/settle Payment; hủy khi PROCESSING/UNKNOWN | **Chờ Q04:** tiêu chí tạm đề xuất chặn hủy bằng 409 khi có attempt chưa rõ; nhóm cần duyệt kết quả mong đợi trước khi viết test |
| API-ORDER-OWNER-01 / Integration phối hợp Duy | NFR-02 | CUSTOMER B đọc chi tiết/tracking của đơn CUSTOMER A; A đọc đơn mình | B nhận 404, A nhận dữ liệu đúng; owner endpoint chờ Q02 |
| E2E-TV4-01 / E2E phối hợp Khôi/Duy/Kiệt | AC-05-01; AC-14-02; AC-15-03 | Menu → tùy chọn → giỏ → đăng nhập → PENDING → mock Payment PAID → Barista PREPARING/READY/COMPLETED; khách tải lại | Giá/mã đơn đúng; chỉ PAID vào queue; trạng thái khách khớp backend; chạy API mode ở 1440/768/390, ghi evidence riêng |

## 2. Điều kiện thực hiện và lưu bằng chứng

- Unit kiểm ma trận độc lập với DB; integration transaction/race cần PostgreSQL thật, migrations đầy đủ và dữ liệu riêng. Không dùng mock repository để chứng minh chống bán vượt tồn kho.
- Concurrency dùng nhiều request/connection, đồng bộ điểm bắt đầu để tạo tranh chấp; kiểm cả HTTP và số bản ghi/stock cuối cùng. Kiểm chứng snapshot/history theo ID dữ liệu test.
- Auth là backend thật; chỉ gateway thanh toán được mô phỏng. E2E dùng API mode và phối hợp owner UI; không thay backend lỗi bằng mock.
- Dùng DB kiểm thử riêng. Không reset hoặc migrate DB nhóm để chạy các ca phá lỗi/rollback. Nếu Docker/DB không chạy, ghi BLOCKED hoặc SKIPPED kèm lý do; không ghi PASS.
- Mỗi lần chạy lưu: test ID, commit SHA, môi trường/DB version, lệnh chạy, thời điểm, PASS/FAIL/SKIPPED, log và ảnh/video nếu có. Các đường dẫn evidence Assignment 2 sẽ được thêm sau khi thực hiện thật.
- Test chưa chạy không được ghi thành PASSED chỉ vì đã có code tương tự ở Assignment 1. Nhóm phải chốt chính sách tái sử dụng trước khi chọn implementation/test cho Assignment 2.

## 3. Mẫu ghi một lần chạy

```text
Test ID:
Assignment 2 commit SHA:
Môi trường và PostgreSQL version:
Lệnh chạy:
Thời điểm:
Kết quả thực tế:
PASS / FAIL / SKIPPED:
Link log/ảnh:
Người thực hiện / người review:
```

Đây là mẫu để điền khi chạy; hiện chưa có lần chạy Assignment 2 nào được xác nhận trong tài liệu này.
