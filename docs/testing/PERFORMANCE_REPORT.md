# Báo cáo kiểm thử hiệu năng (Performance Test) — BrewLite 1.0

**Ngày đo:** 2026-11-17  
**Mục tiêu NFR (theo `docs/ASSIGNMENT1_REQUIREMENTS.md`):** Mọi API phản hồi **< 500 ms** với dữ liệu mẫu.  
**Môi trường đo:** NestJS compiled build (`backend/dist/main`, cổng `3001`), PostgreSQL 15 (`docker compose up -d postgres`, cổng `5434`, 17 migrations + seed data), chạy cục bộ trên macOS.

---

## 1. Hướng dẫn chạy Postman Performance Test trên giao diện Postman

File collection chuyên dụng: [performance-postman.collection.json](performance-postman.collection.json) (13 request luồng chính, không chứa negative test `4xx` để phản ánh đúng Error Rate % trong Postman Performance Runner, tự động hoàn kho qua `POST /orders/:id/cancel` sau mỗi lượt đặt đơn, kèm assertion `pm.response.responseTime < 500`).

1. Mở Postman → **Import** file `docs/testing/performance-postman.collection.json`.
2. Chọn Collection **BrewLite - Performance Load Test** → bấm **Run**.
3. Chuyển sang tab **Performance**:
   - **Virtual users:** `10` (hoặc `20`)
   - **Test duration:** `1 minute` (hoặc `30 seconds`)
   - **Load profile:** `Fixed` hoặc `Ramp up`
4. Bấm **Run** và chụp biểu đồ Response Time (avg/p90/p95/p99), Throughput (requests/sec) và Error %.

> **Lưu ý khi chạy Virtual Users cao:** Khi nhiều Virtual User đồng thời tạo đơn (`POST /orders`) hoặc thêm giỏ (`POST /cart/items`) trên cùng sản phẩm/nguyên liệu với tốc độ hàng trăm req/s liên tục (không có delay giữa các bước), cơ chế PostgreSQL `Serializable` (`P2034`) và Optimistic Locking (`Product.version` / `Ingredient.version`) sẽ chủ động từ chối giao dịch xung đột bằng **`409 Conflict`** (không lỗi `500`, không âm kho). Để đo độ trễ ổn định với `0%` lỗi trong Postman GUI, có thể chạy `1–5 VUs` hoặc đặt `Delay: 100 ms` giữa các request.

---

## 2. Kết quả đo Newman tuần tự (15 iterations = 195 requests)

Lệnh chạy:
```bash
npx --yes newman run docs/testing/performance-postman.collection.json -n 15
```

- **Tổng requests:** 195 | **Assertions:** 390/390 PASS (**0 failed**, Error rate **0.00%**)
- **Thời gian chạy:** 4.5s | **Trung bình toàn bộ:** **12 ms** (min: 1 ms, max: 112 ms, s.d.: 18 ms)
- **Kết luận NFR (< 500 ms):** **ĐẠT 100%** (max `112 ms` tại `POST /auth/register` dùng `bcrypt`).

| Bước / Endpoint | Min (ms) | Avg (ms) | p95 (ms) | Max (ms) | Kết quả (< 500 ms) |
|---|---:|---:|---:|---:|---|
| `01. POST /auth/register` | 65 | 72.1 | 112 | 112 | PASS |
| `02. GET /auth/me` | 2 | 2.5 | 7 | 7 | PASS |
| `03. GET /products` | 4 | 6.7 | 17 | 17 | PASS |
| `04. GET /products/:id` | 4 | 6.8 | 12 | 12 | PASS |
| `05. POST /products/preview` | 4 | 7.9 | 12 | 12 | PASS |
| `06. POST /products/availability` | 3 | 5.7 | 8 | 8 | PASS |
| `07. POST /cart/items` | 13 | 17.6 | 24 | 24 | PASS |
| `08. GET /cart` | 4 | 5.2 | 7 | 7 | PASS |
| `09. POST /orders` | 9 | 12.2 | 23 | 23 | PASS |
| `10. GET /orders/me` | 3 | 4.7 | 13 | 13 | PASS |
| `11. POST /orders/:id/cancel` | 9 | 11.1 | 17 | 17 | PASS |
| `12. GET /loyalty/me` | 1 | 2.1 | 3 | 3 | PASS |
| `13. POST /promotions/validate` | 1 | 1.7 | 3 | 3 | PASS |

---

## 3. Kết quả Load Test đồng thời (10 VUs & 20 VUs)

Đo bằng kịch bản bất đồng bộ với 10 Virtual Users (10s) và 20 Virtual Users (15s) chạy liên tục (0 ms think-time) trên 10 sản phẩm seed:

### 3.1. Kịch bản 10 Virtual Users (10.06s)
- **Tổng requests:** 10,810 | **Throughput:** **1,074.4 req/s**
- **Độ trễ tổng thể:** avg **8.8 ms**, p50 **6.0 ms**, p95 **26.1 ms**, p99 **37.4 ms**, max **256.8 ms** (< 500 ms)
- **Lỗi `5xx`:** **0** | **Xung đột `409 Conflict` (concurrency control):** 615/1030 ở `POST /cart/items` (`P2034` Serializable) và 780/1030 ở `POST /orders` (CAS `version` mismatch / giữ chỗ nguyên liệu dùng chung).

### 3.2. Kịch bản 20 Virtual Users (15.21s)
- **Tổng requests:** 19,204 | **Throughput:** **1,262.2 req/s**
- **Độ trễ tổng thể:** avg **15.0 ms**, p50 **9.5 ms**, p95 **44.9 ms**, p99 **67.6 ms**, max **431.7 ms** (< 500 ms)
- **Lỗi `5xx`:** **0** | **Xung đột `409 Conflict`:** 1,099/1,866 ở `POST /cart/items` và 1,604/1,866 ở `POST /orders`.

| Endpoint (20 VUs, 15s) | Số request | Avg (ms) | p95 (ms) | Max (ms) | Status codes |
|---|---:|---:|---:|---:|---|
| `POST /auth/register` | 20 | 250.4 | 431.7 | 431.7 | `201`: 20 |
| `GET /auth/me` | 1,866 | 3.4 | 6.5 | 37.5 | `200`: 1,866 |
| `GET /products` | 1,866 | 9.1 | 13.9 | 103.9 | `200`: 1,866 |
| `GET /products/:id` | 1,866 | 11.5 | 18.6 | 120.0 | `200`: 1,866 |
| `POST /products/preview` | 1,866 | 13.4 | 20.5 | 117.3 | `200`: 1,866 |
| `POST /products/availability` | 1,866 | 11.2 | 17.2 | 94.7 | `200`: 1,866 |
| `POST /cart/items` | 1,866 | 38.4 | 58.9 | 190.1 | `201`: 767, `409`: 1,099 |
| `GET /cart` | 1,866 | 9.7 | 18.6 | 128.2 | `200`: 1,866 |
| `POST /orders` | 1,866 | 36.1 | 59.1 | 196.9 | `201`: 262, `409`: 1,604 |
| `GET /orders/me` | 262 | 14.9 | 25.3 | 63.5 | `200`: 262 |
| `POST /orders/:id/cancel` | 262 | 50.2 | 81.9 | 199.7 | `201`: 262 |
| `GET /loyalty/me` | 1,866 | 5.9 | 10.0 | 52.9 | `200`: 1,866 |
| `POST /promotions/validate` | 1,866 | 3.9 | 7.2 | 73.4 | `201`: 1,866 |

---

## 4. Tổng hợp kiểm thử toàn bộ trong phiên 2026-11-17

- **Frontend unit tests (`npm --prefix frontend test`):** **30/30 PASS**.
- **Backend Jest (`npm --prefix backend test -- --runInBand`):** **30/30 non-DB suites (329/329 tests) PASS**; 7 PostgreSQL opt-in suites được skip khi chạy mode không-DB.
- **Postman Performance Collection (`performance-postman.collection.json`, 15 iterations):** **195/195 requests, 390/390 assertions PASS** (`< 500 ms`).
- **Functional Postman Collections (`tv1`–`tv6`, lượt chạy gần nhất 2026-11-15):** **TV1, TV2, TV3, TV4, TV6 PASS 100%**; **TV5 (`POST /payments`) bị chặn `503`** do `.env` cục bộ chưa có credential VNPAY Sandbox hợp lệ (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_QUERY_IP_ADDRESS`).
