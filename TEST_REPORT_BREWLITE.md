# Biên bản kiểm thử nghiệm thu BrewLite Coffee Ordering System

**Ngày kiểm thử:** 19/10/2026 (Asia/Ho_Chi_Minh)
**Mã nguồn nền:** `b87db13` sau pull/merge, cùng các thay đổi trong cây làm việc hiện tại
**Kết luận:** **ĐẠT nghiệm thu kỹ thuật cho 9 user stories đã nêu**, trên PostgreSQL QA riêng và gateway thanh toán mock.

## I. Môi trường kiểm thử

| Thành phần | Phiên bản/cấu hình |
|---|---|
| Node.js / npm | v24.10.0 / 11.6.0 |
| Backend | NestJS 12, Prisma Client 6.19.3, Jest 30, Supertest 7 |
| Frontend | Next.js 16.3.8, React 19.2.8, Zustand 5 |
| Database | PostgreSQL 15.19 Docker; database QA UUID riêng, áp dụng đủ 11 migrations rồi xóa |
| Lệnh tái lập | `cd backend && set -a; source ../.env; set +a; npm run test:acceptance`; `cd frontend && npm test` |

Đã rà soát `backend/src`, `backend/test`, `frontend/src/stores/cart.ts` và các test frontend. Trước lượt nghiệm thu, `backend/test` chỉ có smoke E2E, fixture và benchmark; phần lớn test nghiệp vụ ở `backend/src/**/*.spec.ts`. Đã thêm năm file nghiệm thu theo US và sửa cấu hình E2E cho NestJS ESM. Script `test:acceptance` tạo database QA mới, chạy migration, Jest coverage và E2E, rồi xóa database QA; không reset database ứng dụng.

## II. Ma trận đối chiếu Test Cases với 9 User Stories

| US | Test Case ID | Mục tiêu và bằng chứng | Kết quả |
|---|---|---|---|
| US-01 | P-01–03 | `GET /api/products`: danh sách, rỗng, lỗi DB 500 không lộ thông tin kết nối (`test/products.e2e-spec.ts`) | **PASS** |
| US-02 | P-04–07 | Chi tiết UUID, S/M/L, topping/giá của từng sản phẩm độc lập (`test/products.e2e-spec.ts`, product-detail/cart-pricing suite) | **PASS** |
| US-03 | C-01–05 | Thêm, tăng/giảm số lượng, xóa/clear, dòng khác size/topping, tính lại tổng theo giá server (cart HTTP suite, frontend unit) | **PASS** |
| US-04 | A-01–05 | Register bcrypt, chống trùng email; login cấp JWT có `userId`, `role`, `sub`, `sessionVersion`; 401/403 cho quyền sai. Guard vẫn đọc role hiện tại từ DB (`test/auth.e2e-spec.ts`) | **PASS** |
| US-05 | M-01–07 | PAID/FAILED, mock gateway, replay cùng key không charge hai lần; nhận `Idempotency-Key` từ header hoặc body, từ chối key không khớp; xóa giỏ server sau PAID (`test/payments.e2e-spec.ts`, Payment PostgreSQL suite) | **PASS** |
| US-06 | O-01–03 | `/orders/me` cần JWT; query lọc `userId`, detail của user khác trả 404 (Orders HTTP/PostgreSQL suite) | **PASS** |
| US-07 | L-01–05 | `WELCOME10` giảm giá; `loyaltyPoints` và `LoyaltyLog` chỉ ghi khi PAID, đúng một lần khi retry; rollback đồng bộ nếu settlement lỗi (Orders/Payment PostgreSQL suite) | **PASS** |
| US-08 | O-04–08 | Giá tính từ DB, transaction, stock/version CAS; 8 request cùng mua món cuối chỉ 1 thành công; rollback giữ stock/version và không tạo order (Orders PostgreSQL suite) | **PASS** |
| US-09 | S-01–03 | Ma trận 49 cặp chặn bước nhảy sai, cho `PREPARING → CANCELLED`; hủy qua API Barista với lý do, ghi lý do và hoàn kho (`test/order-state-machine.spec.ts`, Orders PostgreSQL suite) | **PASS** |

9/9 US có ca kiểm thử và đạt theo tiêu chí được giao. Đây là bao phủ tiêu chí nghiệm thu; code coverage được đo riêng ở Mục IV.

## III. Kết quả kiểm thử chuyên sâu

**Optimistic locking / concurrency:** `Product.version` và stock nằm trong điều kiện `updateMany`. Trên PostgreSQL thật, 8 request tranh cùng 1 món cuối: 1 thành công, 7 `ConflictException`, có đúng 1 order và stock còn 0. Ca đa món và lỗi ghi order xác nhận transaction rollback.

**Idempotency / atomicity:** Payment khóa hàng Order, ghi claim và gateway journal, rồi settle Order/điểm/log/giỏ/Payment trong cùng transaction. Replay cùng key trả kết quả đã lưu, không gọi gateway hay cấp điểm lại. Header `Idempotency-Key` hoạt động và body cũ vẫn tương thích. Test chèn lỗi sau các thao tác settlement: Order, điểm, log và giỏ cùng rollback; replay từ instance thứ hai phục hồi từ journal. UNKNOWN không tự chuyển PAID.

**Loyalty/Voucher:** Migration `20261019000000_loyalty_log` thêm `loyalty_logs` với unique `order_id`, cùng cột lý do hủy `orders.cancel_reason`. Provider `PromotionDiscount` hỗ trợ các mã mặc định; test PostgreSQL xác nhận `WELCOME10` giảm 10.000đ trên đơn 90.000đ. Migration không tạo log ngược cho các đơn PAID lịch sử; nếu cần audit quá khứ, phải đối soát dữ liệu cũ trước khi backfill. Gateway hiện là mock, chưa chứng minh hoàn tiền thật khi hủy đơn đã PAID/PREPARING.

## IV. Log trích xuất từ test runner

Lượt cuối chạy `npm run test:acceptance` trên database QA mới, áp dụng đủ 11 migrations:

```text
Backend Jest + coverage: Test Suites: 25 passed, 25 total
Backend Jest + coverage: Tests:       301 passed, 301 total
E2E Jest:                Test Suites: 6 passed, 6 total
E2E Jest:                Tests:       185 passed, 185 total
Coverage (src):          Statements 91.69% | Branches 77.47% | Functions 98.72% | Lines 92.06%
Frontend unit:           15 passed, 0 failed
Backend build/typecheck/lint: PASS / PASS / PASS
Frontend scoped lint/build (--webpack): PASS / PASS
```

E2E tái sử dụng một số suite PostgreSQL từ `src`, nên không cộng hai tổng số test để suy ra số ca độc lập. Coverage là của backend `src` trong Jest chính; không bao gồm frontend. Log đầy đủ lưu tại `/private/tmp/brewlite-acceptance-fixed-2026-10-19.log`; database QA đã được xóa sau chạy.

## V. Kết luận và chữ ký nghiệm thu kỹ thuật

**Đạt nghiệm thu kỹ thuật 9/9 user stories** trong phạm vi code và môi trường QA trên. Database Compose cục bộ đã áp dụng đủ 11 migrations trong lượt cập nhật giao diện ngày 19/10/2026; các môi trường khác vẫn cần chạy migration theo quy trình deploy. Thanh toán sản xuất, hoàn tiền thực và backfill lịch sử điểm nằm ngoài bằng chứng nghiệm thu này.

**Bổ sung kiểm tra giao diện nghiệm thu ngày 19/10/2026:** Login/register có nút hiện/ẩn mật khẩu; banner và ghi chú demo đã bỏ; bộ chọn kết quả gateway chỉ bật khi chủ động cấu hình kiểm thử. Frontend Compose chạy API mode mặc định; Barista đọc lịch sử và cho hủy có lý do từ API. Đã kiểm chứng frontend lint/build, 16/16 unit, Playwright auth 2/2 tại 1440/768/390, API menu 2/2 dùng PostgreSQL; backend lint/build và 2/2 unit cho `POST /promotions/validate`. HTTP smoke endpoint này trả 201 với `WELCOME10`, đơn 90.000đ được preview giảm 10.000đ. Các kết quả này bổ sung cho log QA ở Mục IV, không thay thế lượt coverage 301/301 trước đó.

**Sửa lời mời thành viên:** Tài khoản CUSTOMER được tham gia Loyalty ngay khi đăng ký tài khoản; thẻ trang chủ chuyển sang “Xem điểm của tôi” và dẫn `/profile` khi đã đăng nhập, thay vì dẫn lại `/register`. Bài Playwright xác minh CTA ở cả hai trạng thái khách và CUSTOMER; công thức điểm hiển thị khớp backend: `floor(Order.total / 10.000)` chỉ khi PAID.

**Bổ sung kiểm tra phiên và luồng thanh toán ngày 19/10/2026:** Playwright trên Compose API mode xác nhận tài khoản mới đăng ký → đăng xuất → đăng nhập lại được; Customer và Barista đồng thời hoạt động trong hai browser context riêng. Hai tab cùng context dùng chung cookie nên không đại diện cho hai phiên. Bản sandbox có nút “Kiểm thử thanh toán” trên checkout để mở bộ chọn PAID/PAYMENT_FAILED/UNKNOWN; bản production tắt cờ sẽ không hiện nút. Browser E2E tạo Order/Payment thật trên PostgreSQL cho PAID, PAYMENT_FAILED, UNKNOWN; kiểm tra trạng thái Order, Payment và LoyaltyLog tương ứng; fixture được xóa sau bài chạy. Gateway vẫn chỉ mô phỏng, không trừ tiền thật.

```text
Playwright API/auth/payment: 5 passed (10.3s)
  - Password visibility, responsive auth, member CTA: 3 passed
  - Logout → login lại; Customer/Barista tách browser context: 1 passed
  - Checkout PAID (1440px), PAYMENT_FAILED (768px), UNKNOWN (390px): 1 passed
Frontend unit: 16 passed, 0 failed
Frontend lint / Docker production build: PASS / PASS
git diff --check: PASS
```

Lượt browser đầu phát hiện fixture sản phẩm thiếu cấu hình S/M/L (backend trả lỗi dữ liệu hợp lệ); đã sửa fixture. Lượt responsive tiếp theo phát hiện header tràn 52px khi tên Customer dài tại 390px; đã sửa CSS và chạy lại toàn bộ bài browser đến PASS. Hai lỗi này không còn trong kết quả cuối.

**Thao tác nghiệm thu thanh toán:** Trên checkout sandbox, nút “Kiểm thử thanh toán” hiện ngay dưới hai phương thức Ví điện tử/Thẻ ngân hàng. Playwright bấm nút từ `/checkout` thường, chọn PAID/PAYMENT_FAILED/UNKNOWN và xác nhận trạng thái trong PostgreSQL: **1/1 browser test PASS**, frontend lint và Docker build PASS. Bản triển khai tắt cờ sandbox không hiển thị nút.

**Người ký xác nhận kỹ thuật:** Senior QA / Test Automation Engineer — 19/10/2026.
**Chủ dự án/người phê duyệt phát hành:** Chưa ký.
