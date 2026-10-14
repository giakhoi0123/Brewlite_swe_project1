# Kiểm thử

Đã chạy trong phiên triển khai:
- `npm run build` ở frontend: PASS, 13 route tạo thành công.
- `npx prisma generate && npm run build && npm test -- --runInBand` ở backend: PASS build, 37/37 tests.
- `npm run lint` backend: PASS.
- `npm run lint` frontend: PASS, không có cảnh báo.
- `npm test` frontend: 3/3 tests qua (giá, order/payment idempotency, failure/unknown, loyalty, promotion, Barista state).
- `docker compose config --quiet`: PASS sau khi tạo `.env` local (đã ignore).
- Next production server cổng 3100: 10 route (menu, cart, auth, checkout, orders, profile, Barista, dynamic detail/result) đều HTTP 200. Chưa kiểm tra tương tác trình duyệt.
- Docker Compose/DB E2E: chưa chạy vì Docker daemon không khởi động (`Cannot connect to the Docker daemon`).

Checklist còn cần chạy khi có Docker: đăng ký thật vào PostgreSQL, email trùng/không hợp lệ, login/logout/refresh, role 401/403, seed Barista; Products API seed; menu/giỏ/checkout demo; 3 kết quả thanh toán; tracking; Barista; responsive 375px/desktop. Không đánh dấu Task 01/07/09 hoàn tất trước E2E thực tế.
