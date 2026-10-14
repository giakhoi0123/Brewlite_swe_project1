# BrewLite backend

NestJS + Prisma/PostgreSQL. Tài liệu khởi động chính ở `../README.md`; API contract ở `../docs/API_CONTRACT.md`. Module hiện có: Auth đầy đủ về mã và unit/integration-style tests, Products API; Orders/Payments/Promotion/Loyalty/Staff Orders chưa có. Dùng `.env` ở gốc repo, không commit bí mật. `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:seed`, `npm run start:dev`, `npm test -- --runInBand` là các script chính. Không dùng `prisma db push` cho môi trường cộng tác khi đã có migration.
