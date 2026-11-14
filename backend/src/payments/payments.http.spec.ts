import { jest } from '@jest/globals';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';
import { AdminJwtAuthGuard } from '../auth/admin-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AdminPaymentsController,
  normalizeVnpayIp,
  PaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';

describe('Payments HTTP contract', () => {
  let app: INestApplication;
  const pay = jest.fn<PaymentsService['pay']>();
  const reconcile = jest.fn<PaymentsService['reconcile']>();
  const current = jest.fn<PaymentsService['current']>();
  const requestAdminCancellation =
    jest.fn<PaymentsService['requestAdminCancellation']>();
  const listAdminApprovals = jest.fn<PaymentsService['listAdminApprovals']>();
  const reviewAdminApproval = jest.fn<PaymentsService['reviewAdminApproval']>();
  const reviewAdminCancellation =
    jest.fn<PaymentsService['reviewAdminCancellation']>();
  const handleIpn = jest.fn<PaymentsService['handleIpn']>();
  const handleReturn = jest.fn<PaymentsService['handleReturn']>();
  const orderId = '21a650c7-8597-4a01-a8e2-000000000001';
  const idempotencyKey = '41a650c7-8597-4a01-a8e2-000000000001';
  let role: Role = Role.CUSTOMER;
  const response = {
    id: '31a650c7-8597-4a01-a8e2-000000000001',
    orderId,
    method: 'VNPAY_QR' as const,
    status: 'PROCESSING' as const,
    idempotencyKey,
    paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?signed',
    expiresAt: '2026-10-21T03:15:00.000Z',
  };

  beforeAll(async () => {
    const authenticationGuard = {
      canActivate: (context: {
        switchToHttp(): {
          getRequest(): { user?: { userId: string; role: Role } };
        };
      }) => {
        context.switchToHttp().getRequest().user = {
          userId: 'customer-1',
          role,
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [PaymentsController, AdminPaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            pay,
            reconcile,
            current,
            requestAdminCancellation,
            listAdminApprovals,
            reviewAdminApproval,
            reviewAdminCancellation,
            handleIpn,
            handleReturn,
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authenticationGuard)
      .overrideGuard(AdminJwtAuthGuard)
      .useValue(authenticationGuard)
      .compile();

    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    role = Role.CUSTOMER;
    pay.mockResolvedValue(response);
    reconcile.mockResolvedValue(response);
    current.mockResolvedValue(response);
    requestAdminCancellation.mockResolvedValue(response);
    listAdminApprovals.mockResolvedValue([]);
    reviewAdminApproval.mockResolvedValue(response);
    reviewAdminCancellation.mockResolvedValue(response);
    handleIpn.mockResolvedValue({
      RspCode: '00',
      Message: 'Confirm Success',
    });
    handleReturn.mockResolvedValue(
      `https://coffee.example.test/payment/${orderId}/verifying`,
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('accepts only the documented authenticated VNPAY_QR request', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, method: 'VNPAY_QR', idempotencyKey })
      .expect(201, response);
    expect(pay).toHaveBeenCalledWith(
      'customer-1',
      { orderId, method: 'VNPAY_QR', idempotencyKey },
      expect.any(String),
    );
  });

  it('accepts an authenticated ADMIN_APPROVAL request without client outcome', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, method: 'ADMIN_APPROVAL', idempotencyKey })
      .expect(201);
    expect(pay).toHaveBeenCalledWith(
      'customer-1',
      { orderId, method: 'ADMIN_APPROVAL', idempotencyKey },
      expect.any(String),
    );
  });

  it.each([
    { method: 'CARD' },
    { method: 'WALLET' },
    { method: 'CASH' },
    { method: 'VNPAY_QR', demoOutcome: 'PAID' },
    { method: 'VNPAY_QR', amount: 1 },
    { method: 'VNPAY_QR', userId: 'attacker' },
  ])('rejects unsupported or client-controlled fields: %j', async (extra) => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, idempotencyKey, ...extra })
      .expect(400);
    expect(pay).not.toHaveBeenCalled();
  });

  it('rejects an authenticated BARISTA from the customer payment endpoint', async () => {
    role = Role.BARISTA;
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({ orderId, method: 'VNPAY_QR', idempotencyKey })
      .expect(403);
    expect(pay).not.toHaveBeenCalled();
  });

  it('lets the owning CUSTOMER request server-side reconciliation', async () => {
    await request(app.getHttpServer())
      .post(`/api/payments/${orderId}/reconcile`)
      .expect(200, response);
    expect(reconcile).toHaveBeenCalledWith('customer-1', orderId);

    role = Role.BARISTA;
    await request(app.getHttpServer())
      .post(`/api/payments/${orderId}/reconcile`)
      .expect(403);
  });

  it('lets a CUSTOMER request Admin cancellation with a required reason', async () => {
    await request(app.getHttpServer())
      .post(`/api/payments/${orderId}/cancel-request`)
      .send({ reason: 'Khách đổi kế hoạch' })
      .expect(200, response);
    expect(requestAdminCancellation).toHaveBeenCalledWith(
      'customer-1',
      orderId,
      { reason: 'Khách đổi kế hoạch' },
    );

    await request(app.getHttpServer())
      .post(`/api/payments/${orderId}/cancel-request`)
      .send({ reason: '' })
      .expect(400);
    role = Role.BARISTA;
    await request(app.getHttpServer())
      .post(`/api/payments/${orderId}/cancel-request`)
      .send({ reason: 'Không được phép' })
      .expect(403);
  });

  it('restricts the admin queue and decisions to ADMIN accounts', async () => {
    await request(app.getHttpServer()).get('/api/admin/payments').expect(403);

    role = Role.ADMIN;
    await request(app.getHttpServer())
      .get('/api/admin/payments?status=PROCESSING')
      .expect(200, []);
    expect(listAdminApprovals).toHaveBeenCalledWith('PROCESSING');

    await request(app.getHttpServer())
      .patch(`/api/admin/payments/${response.id}/review`)
      .send({ decision: 'REJECT', note: 'Không xác nhận yêu cầu' })
      .expect(200, response);
    expect(reviewAdminApproval).toHaveBeenCalledWith(
      'customer-1',
      response.id,
      { decision: 'REJECT', note: 'Không xác nhận yêu cầu' },
    );

    await request(app.getHttpServer())
      .patch(`/api/admin/payments/${response.id}/cancel-review`)
      .send({ decision: 'APPROVE' })
      .expect(200, response);
    expect(reviewAdminCancellation).toHaveBeenCalledWith(
      'customer-1',
      response.id,
      { decision: 'APPROVE' },
    );
  });

  it('requires a rejection reason and rejects client-controlled result fields', async () => {
    role = Role.ADMIN;
    await request(app.getHttpServer())
      .patch(`/api/admin/payments/${response.id}/review`)
      .send({ decision: 'REJECT' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/admin/payments/${response.id}/review`)
      .send({ decision: 'APPROVE', status: 'PAID' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/admin/payments/${response.id}/cancel-review`)
      .send({ decision: 'REJECT' })
      .expect(400);
  });

  it('exposes public IPN as HTTP 200 JSON', async () => {
    await request(app.getHttpServer())
      .get('/api/payments/vnpay/ipn')
      .query({ vnp_TxnRef: 'ref', vnp_SecureHash: 'hash' })
      .expect(200, { RspCode: '00', Message: 'Confirm Success' });
    expect(handleIpn).toHaveBeenCalledWith(
      expect.objectContaining({ vnp_TxnRef: 'ref', vnp_SecureHash: 'hash' }),
    );
  });

  it('exposes public Return as a fixed 302 redirect', async () => {
    await request(app.getHttpServer())
      .get('/api/payments/vnpay/return')
      .query({ vnp_TxnRef: 'ref', redirect: 'https://evil.test' })
      .expect(302)
      .expect(
        'Location',
        `https://coffee.example.test/payment/${orderId}/verifying`,
      );
  });

  it('normalizes loopback and IPv4-mapped request addresses', () => {
    expect(normalizeVnpayIp('::1')).toBe('127.0.0.1');
    expect(normalizeVnpayIp('::ffff:203.0.113.8')).toBe('203.0.113.8');
    expect(normalizeVnpayIp('2001:db8::1')).toBe('2001:db8::1');
  });
});
