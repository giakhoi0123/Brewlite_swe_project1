import { jest } from '@jest/globals';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

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

  it('rejects extra identity fields instead of trusting the client', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, method: 'WALLET', idempotencyKey, userId: 'attacker' })
      .expect(400);
    expect(pay).not.toHaveBeenCalled();
  });
});
