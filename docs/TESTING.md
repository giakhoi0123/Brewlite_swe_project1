# Kiểm thử

Lượt giỏ hàng server (2026-10-15, Windows, PostgreSQL Compose cổng 5434):
- Backend `npm run build`, `npm run lint` PASS; `jest --runInBand` PASS 48/48 (37 cũ + 11 cart: tính giá, gộp cấu hình, validate, tồn kho, đổi size/gộp, riêng tư theo user, merge giỏ khách).
- `prisma migrate deploy` áp dụng `20261015000000_add_cart`; `prisma migrate diff` không còn drift; 10 sản phẩm giữ nguyên.
- Smoke HTTP backend thật + PostgreSQL: 12/12 (401 khi chưa đăng nhập, giá server, gộp, đổi size, 409 tồn kho, 400 khi client gửi giá, merge, xóa, CSRF 403).
- Frontend `tsc`, `lint`, `build` PASS; `npm test` PASS 4/4 (thêm mock cart).
- Trình duyệt Edge, frontend API mode: khách thêm món → đăng ký → giỏ gộp lên server → tăng số lượng, đổi size L (giá UI = giá server) → xóa localStorage + reload vẫn còn → đăng xuất badge 0 → đăng nhập lại 3 món, không nhân đôi → xóa tất cả: 8/8 PASS.
- Playwright (kênh `msedge` vì máy chưa cài Chromium của Playwright): mock 3/3 PASS, API mode 2/2 PASS.

Sau lượt chỉnh UI theo Stitch: `npm --prefix frontend run build` PASS (13 route), `npm --prefix frontend run lint` PASS, `npm --prefix frontend run test` PASS 3/3. Playwright chụp trang chủ, login, chi tiết sản phẩm và giỏ hàng ở desktop 1440 px/mobile 390 px; thêm món vào giỏ thành công và các màn được kiểm tra không tràn ngang. Chưa chạy lại bộ E2E auth đầy đủ trong lượt này vì backend không khởi động.

Đã chạy trong phiên triển khai:
- `npm run build` ở frontend: PASS, 13 route tạo thành công.
- `npx prisma generate && npm run build && npm test -- --runInBand` ở backend: PASS build, 37/37 tests.
- `npm run lint` backend: PASS.
- `npm run lint` frontend: PASS, không có cảnh báo.
- `npm test` frontend: 3/3 tests qua (giá, order/payment idempotency, failure/unknown, loyalty, promotion, Barista state).
- `docker compose config --quiet`: PASS sau khi tạo `.env` local (đã ignore).
- Next production server cổng 3100: 10 route (menu, cart, auth, checkout, orders, profile, Barista, dynamic detail/result) đều HTTP 200.
- `docker compose up -d --build backend frontend`: PASS, 3 container chạy; DB healthy.
- `npm run db:migrate`, `npm run db:seed`: PASS sau khi `source .env`; 4 migrations và 10 sản phẩm seed.
- `python3 scripts/smoke_http.py`: PASS với backend Compose/PostgreSQL: Products list/detail, auth validation/duplicate/cookie/login/logout, CSRF, CUSTOMER 403, BARISTA 200.
- Kiểm tra bcrypt trực tiếp trong DB: PASS, hash khác plaintext và `bcrypt.compare` đúng.
- ProductService REST adapter đọc DB: PASS, 10 món và chi tiết S/M/L/stock.
- HTTP Compose: frontend `/`, `/cart`, `/login` trả 200; backend `/api/products` trả 200 và 10 món; preflight CORS 204 đúng origin/credentials.

- `npm --prefix frontend run test:e2e -- --grep-invert "API mode"`: PASS 3/3 Chromium E2E: menu/tùy chỉnh, giỏ persistence/quantity/remove/clear, auth redirect/đăng ký, promo sai/đúng, Card fail/retry/success, order timeline, loyalty, Barista PAID→COMPLETED, mobile search/hết hàng/UNKNOWN.
- `BREWLITE_RUN_API_E2E=1 npm --prefix frontend run test:e2e -- --grep "API mode"`: PASS 2/2 Chromium E2E khi Next chạy API mode trên origin 3000: 10 sản phẩm từ PostgreSQL, S/M/L, topping, giá động, loading/empty/error/retry.

Orders/Payments API thật chưa có; Task 07/09/10 chưa thể VERIFIED_COMPLETE toàn bộ. Build Docker có cảnh báo audit dependencies; cần rà soát trước production.
