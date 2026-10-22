import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma.service';

const databaseUrl = process.env.ORDERS_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase(
  'Payment consistency migration against legacy rows (PostgreSQL)',
  () => {
    let db: PrismaService;
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20261017000000_payment_consistency/migration.sql',
      ),
      'utf8',
    )
      .replace(/--[^\n]*/g, '')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && s !== 'BEGIN' && s !== 'COMMIT');

    beforeAll(async () => {
      db = new PrismaService({ datasources: { db: { url: databaseUrl! } } });
      await db.$connect();
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('preserves legacy final results without inventing a journal or applied timestamp', async () => {
      await db.$transaction(async (tx) => {
        // pg_temp shadows payments only inside this connection/transaction.
        await tx.$executeRawUnsafe(
          'CREATE TEMP TABLE payments (id UUID PRIMARY KEY, order_id UUID NOT NULL, status "PaymentStatus" NOT NULL) ON COMMIT DROP',
        );
        for (const status of ['PAID', 'PAYMENT_FAILED', 'UNKNOWN']) {
          await tx.$executeRaw`INSERT INTO payments(id, order_id, status) VALUES (${randomUUID()}::uuid, ${randomUUID()}::uuid, ${status}::"PaymentStatus")`;
        }
        for (const sql of migration) await tx.$executeRawUnsafe(sql);
        const rows = await tx.$queryRaw<
          Array<{
            status: string;
            gateway_status: string | null;
            applied_at: Date | null;
          }>
        >`SELECT status, gateway_status, applied_at FROM payments ORDER BY status`;
        expect(rows).toHaveLength(3);
        for (const row of rows)
          expect(row).toMatchObject({ gateway_status: null, applied_at: null });
        expect(rows.map((r) => r.status).sort()).toEqual(
          ['PAID', 'PAYMENT_FAILED', 'UNKNOWN'].sort(),
        );
      });
    });

    it('refuses duplicate live legacy attempts instead of silently deleting financial rows', async () => {
      await expect(
        db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            'CREATE TEMP TABLE payments (id UUID PRIMARY KEY, order_id UUID NOT NULL, status "PaymentStatus" NOT NULL) ON COMMIT DROP',
          );
          const orderId = randomUUID();
          for (const status of ['PAID', 'PROCESSING']) {
            await tx.$executeRaw`INSERT INTO payments(id, order_id, status) VALUES (${randomUUID()}::uuid, ${orderId}::uuid, ${status}::"PaymentStatus")`;
          }
          for (const sql of migration) await tx.$executeRawUnsafe(sql);
        }),
      ).rejects.toMatchObject({ code: 'P2010', meta: { code: '23505' } });
    });
  },
);
