import { jest } from '@jest/globals';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PaymentsController } from '../src/payments/payments.controller';
import { PaymentsService } from '../src/payments/payments.service';
import { Prisma } from '@prisma/client';
// These suites exercise the real AppModule, persisted payments and retries when
// PAYMENTS_TEST_DATABASE_URL / ORDERS_TEST_DATABASE_URL point at a migrated QA DB.
import '../src/payments/payments.postgres.spec';
import '../src/payments/payment-consistency.postgres.spec';

describe('Payments HTTP contract', () => {
  let app: INestApplication;
  const pay = jest.fn<PaymentsService['pay']>();
  const orderId = '21a650c7-8597-4a01-a8e2-000000000001';
  const idempotencyKey = '41a650c7-8597-4a01-a8e2-000000000001';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: { pay } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): { user?: { userId: string } } };
        }) => {
          context.switchToHttp().getRequest().user = { userId: 'customer-1' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    pay.mockReset().mockResolvedValue({
      id: '31a650c7-8597-4a01-a8e2-000000000001',
      orderId,
      method: 'CARD',
      status: 'PAID',
      idempotencyKey,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('accepts the documented payment request for the authenticated user', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, method: 'CARD', idempotencyKey })
      .expect(201)
      .expect({
        id: '31a650c7-8597-4a01-a8e2-000000000001',
        orderId,
        method: 'CARD',
        status: 'PAID',
        idempotencyKey,
      });
    expect(pay).toHaveBeenCalledWith('customer-1', {
      orderId,
      method: 'CARD',
      idempotencyKey,
    });
  });

  it('rejects unsupported methods and malformed idempotency keys', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, method: 'CASH', idempotencyKey: 'same-key' })
      .expect(400);
    expect(pay).not.toHaveBeenCalled();
  });

  it('US-05: accepts Idempotency-Key in the request header', async () => {
    await request(app.getHttpServer()).post('/api/payments')
      .set('Idempotency-Key', idempotencyKey)
      .send({ orderId, method: 'CARD' }).expect(201);
    expect(pay).toHaveBeenCalledWith('customer-1', { orderId, method: 'CARD', idempotencyKey });
  });

  it('rejects mismatched header/body keys before calling the payment service', async () => {
    await request(app.getHttpServer()).post('/api/payments')
      .set('Idempotency-Key', idempotencyKey)
      .send({ orderId, method: 'CARD', idempotencyKey: '51a650c7-8597-4a01-a8e2-000000000001' })
      .expect(400);
    expect(pay).not.toHaveBeenCalled();
  });

  it('US-07: defines a persistent LoyaltyLog entity for payment awards', () => {
    expect(Prisma.dmmf.datamodel.models.map((model) => model.name)).toContain('LoyaltyLog');
  });

  it('accepts a validated sandbox outcome without trusting arbitrary values', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({
        orderId,
        method: 'CARD',
        idempotencyKey,
        demoOutcome: 'PAYMENT_FAILED',
      })
      .expect(201);
    expect(pay).toHaveBeenCalledWith('customer-1', {
      orderId,
      method: 'CARD',
      idempotencyKey,
      demoOutcome: 'PAYMENT_FAILED',
    });

    pay.mockClear();
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, method: 'CARD', idempotencyKey, demoOutcome: 'SUCCESS' })
      .expect(400);
    expect(pay).not.toHaveBeenCalled();
  });

  it('rejects extra identity fields instead of trusting the client', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, method: 'WALLET', idempotencyKey, userId: 'attacker' })
      .expect(400);
    expect(pay).not.toHaveBeenCalled();
  });
});
