# Kiểm chứng Payment consistency

Ngày 2026-10-17. Tiếp tục nhánh hiện có `feature/fix-payment-status` từ `faea93e`; đã fetch origin và xác minh `b6ca9ac` (status fix) là ancestor trước khi sửa. `origin/main` vẫn ở `c2d6922`, chưa chứa status fix. Theo AGENTS giữ nhánh hiện có và cập nhật PR #15; không tạo PR trùng. File audit và tmp chưa commit giữ riêng, không đưa vào PR.

## Phạm vi triển khai

1. **Claim trong transaction ngắn:** khóa hàng Order bằng SELECT FOR UPDATE, kiểm tra user/ownership, key cũ và live attempts. Retry PAYMENT_FAILED → PENDING giữ kho qua state machine có sẵn; tạo Payment PROCESSING cùng transaction. Hết kho hoặc lỗi ghi claim rollback cả Order/kho/history/Payment, chưa gọi gateway.
2. **Gateway ngoài transaction:** chỉ request tạo claim thành công được gọi gateway, với provider key là Payment.id đã lưu. Request cùng key đang xử lý hoặc key mới trên cùng đơn nhận 409; không gọi gateway lần nữa. Hai instance ứng dụng dùng khóa PostgreSQL, không dựa vào mutex trong RAM.
3. **Journal bền vững:** ghi gateway_status trước khi áp dụng trạng thái Order. Lỗi/timeout gateway ghi UNKNOWN; không suy đoán thành PAID. PROCESSING chưa có journal có thể là crash trước hoặc sau charge nên phải giữ khóa chờ đối soát.
4. **Settle nguyên tử:** khóa lại Order, dùng cùng TransactionClient để cập nhật trạng thái/kho/history/điểm và finalize Payment + applied_at. Nếu lỗi, transaction rollback toàn bộ nhưng journal đã commit vẫn còn. Replay cùng key phục hồi từ journal trên instance khác mà không charge lại.
5. **Replay cuối cùng:** trả đúng response Payment đã lưu, không gọi transition/gateway hoặc cộng điểm, kể cả Order đã sang PREPARING/READY/COMPLETED hoặc một Payment thất bại cũ được replay sau lần retry thành công. Key đổi order/method trả 409.

Giữ chính sách điểm hiện có floor(total/10000), không thêm đổi điểm hay UI. Không sửa state machine Orders hoặc logic inventory của TV4; dùng lại transitionInTransaction. DTO/response Payment không đổi.

Commit theo phần: `bb0c222` migration/journal và constraint; `d807605` claim/retry/settle; `00e7fb8` test PostgreSQL và script tái lập; commit tài liệu ghi bằng chứng và bàn giao. [PR #15](https://github.com/giakhoi0123/Brewlite_swe_project1/pull/15) tiếp tục mở vào main, chưa merge.

## Tình huống và kết quả

| Trạng thái lần thanh toán đã lưu | Cùng key, cùng request | Key mới cho cùng đơn |
|---|---|---|
| PROCESSING, journal null | 409, không charge lại | 409, chờ đối soát |
| PROCESSING, journal có kết quả | Phục hồi settle trong transaction rồi trả kết quả | 409, yêu cầu replay key cũ |
| PAID | Trả response cũ, không cộng điểm lại | 409 |
| PAYMENT_FAILED | Trả response thất bại cũ | Retry nếu Order cho phép và đủ kho; reserve trước gateway |
| UNKNOWN | Trả response UNKNOWN, không đổi Order/điểm | 409 đến khi đối soát xác định kết quả |

UNKNOWN sau retry giữ Order **PENDING với kho vừa reserve lại**. Đây là thay đổi có chủ ý: chuyển PAYMENT_FAILED → PENDING và reserve xảy ra trước khi gọi gateway; bản thân kết quả UNKNOWN không làm thêm transition.

## Migration và dữ liệu cũ

`20261017000000_payment_consistency` chạy trong BEGIN/COMMIT:

- Thêm gateway_status nullable và applied_at nullable. Gateway status không được PROCESSING; applied_at chỉ hợp lệ khi final status khớp journal.
- Partial unique index `payments_one_live_attempt_per_order` trên order_id cho PROCESSING/UNKNOWN/PAID. Vẫn giữ unique (user_id,idempotency_key), cho phép lưu nhiều lần PAYMENT_FAILED cũ.
- Không tự backfill timestamp/điểm hoặc đánh dấu Order cũ đã settle. Final rows từ phiên bản cũ được replay nguyên trạng và không tự áp dụng lại điểm. Những sai lệch Payment/Order cũ phải audit riêng.
- Nếu dữ liệu cũ có nhiều live attempts trên cùng đơn, migration từ chối và rollback; không xóa/gộp bản ghi tài chính để ép migration thành công.

Preflight chỉ đọc trước triển khai:

```sql
SELECT order_id, count(*)
FROM payments
WHERE status IN ('PROCESSING', 'UNKNOWN', 'PAID')
GROUP BY order_id HAVING count(*) > 1;
```

Chạy migration bằng migrate deploy trong cửa sổ triển khai có dừng các writer Payment phiên bản cũ. Không dùng db push thay migration vì partial index/CHECK được quản lý bằng SQL. Lượt kiểm chứng này không migrate DB ứng dụng.

## Bằng chứng PostgreSQL

PostgreSQL 15.18 chạy tạm riêng tại loopback 55439. Script mới tạo `brewlite_payments_test_<uuid>`, áp đủ **9 migration**, chạy test và xóa đúng DB vừa tạo. Không truncate/reset DB chung. Chỉ các fixture UUID của lượt test được dọn trong suite.

| Kiểm tra | Kết quả |
|---|---|
| Payment consistency PostgreSQL | 20/20 PASS, hai AppModule/Prisma connections độc lập |
| Migration trên legacy rows/duplicate attempts | 2/2 PASS, bảng tạm riêng trong PostgreSQL thật |
| Status regression qua AppModule | 15/15 PASS |
| Tổng 7 suites liên quan | **105/105 PASS, 0 skipped** |
| Prisma generate, backend build/lint | PASS |
| Payment typecheck `npm --prefix backend run check:payments` | PASS, gồm tests mới và imports |
| Script syntax | PASS |
| Full test typecheck | 5 lỗi baseline, không có lỗi Payment |

Log: [backend-postgres.txt](evidence/payment-consistency/backend-postgres.txt).

Test consistency chỉ điều khiển **gateway bên ngoài** để tạo PAID/FAILED/UNKNOWN, timeout và giữ request đang chạy. AppModule, HTTP/JWT/DTO, adapter, repository, Order/Inventory và PostgreSQL đều thật. Failure injection tại claim, journal và finalize dùng spy một lần; không thay database bằng mock.

Các ca quan trọng đã chạy:

- Cùng key replay PAID sau Barista chuyển PREPARING, không đổi history/điểm; key khác method/order bị từ chối.
- Hai instance tranh cùng key và khác key trên cùng Order; chỉ một external call/claim. Hai Order tranh cùng user key cũng chỉ có một Payment được tạo.
- Retry reserve trước gateway, giữ giá snapshot khi catalog đổi; thiếu kho do đơn khác đã dùng trả 409. Lỗi ghi claim rollback cả reserve/history/Payment.
- UNKNOWN, gateway timeout, UNKNOWN sau retry; replay không tự PAID và key mới bị chặn.
- Gây lỗi **sau khi ghi Payment, Order và điểm trong transaction**, cho cả PAID và PAYMENT_FAILED: tất cả rollback, journal còn nguyên; instance thứ hai replay cùng key phục hồi đúng một lần.
- Lỗi lưu journal và claim PROCESSING cũ không có journal: không auto-expire, không charge lại.
- Kết nối DB thứ hai lấy được Order row lock ngay trong lúc gateway chạy, chứng minh không giữ transaction qua external call.
- Ghi trực tiếp hai live attempts bị unique index chặn dù bỏ qua application lock.

## Chạy lại

Cài dependencies và chuẩn bị PostgreSQL local với quyền CREATE DATABASE. Dùng tài khoản dành cho kiểm thử; script chỉ tạo/migrate/xóa DB UUID riêng, không reset database ở URL đầu vào.

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@127.0.0.1:5434/postgres?schema=public'
npm.cmd --prefix backend run prisma:generate
npm.cmd --prefix backend run test:payments:postgres
npm.cmd --prefix backend run check:payments
npm.cmd --prefix backend run build
npm.cmd --prefix backend run lint
```

Nếu chạy Jest trực tiếp mà không đặt ORDERS_TEST_DATABASE_URL, các suite DB sẽ skipped; không dùng kết quả đó để chốt nghiệm thu. Script test:payments:postgres tự đặt URL cho DB test của chính nó.

## Giới hạn còn lại

- T08/10B toàn bộ chưa VERIFIED_COMPLETE: chưa browser E2E, Docker Compose, gateway ngân hàng hoặc reconciliation tự động. Trong phạm vi consistency backend, code và PostgreSQL tests sẵn sàng review.
- Crash giữa external charge và lưu journal không thể phân biệt với chưa charge nếu provider chưa có lookup. Giữ PROCESSING/UNKNOWN và chặn key mới; cần đối soát với provider bằng Payment.id, không xóa claim hoặc tạo key mới để thử lại. Không tự động retry gateway từ journal thiếu kết quả.
- Nếu Order bị writer khác hủy trong lúc gateway chạy, state machine có thể từ chối settle; journal giữ lại để đối soát, không charge lại. Chính sách hoàn tiền/đảo điểm/hủy khi payment chưa rõ thuộc luồng nghiệp vụ khác, chưa được thêm trong PR này.
- Full test typecheck còn 5 lỗi có sẵn từ main: hai import NoPromotionDiscount trong orders.service.spec.ts/orders.postgres.spec.ts; hai fixture Products HTTP thiếu stock/description và fixture product-detail thiếu stock. Không sửa phần owner khác để làm đẹp kết quả Payment; chưa chạy/chốt full backend suite.
