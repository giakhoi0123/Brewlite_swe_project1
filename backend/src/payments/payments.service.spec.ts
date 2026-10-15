import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import type { Payment } from '@prisma/client';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { PaymentGateway, PaymentOrderPort } from './payment.types';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

const userId = '11a650c7-8597-4a01-a8e2-000000000001';
const orderId = '21a650c7-8597-4a01-a8e2-000000000001';
const paymentId = '31a650c7-8597-4a01-a8e2-000000000001';
const idempotencyKey = '41a650c7-8597-4a01-a8e2-000000000001';
const input: CreatePaymentDto = {
  orderId,
  method: 'CARD',
  idempotencyKey,
};

const payment = (status: Payment['status']): Payment => ({
  id: paymentId,
  userId,
  orderId,
  amount: 98000,
  method: 'CARD',
  status,
  idempotencyKey,
  createdAt: new Date('2026-10-15T00:00:00.000Z'),
  updatedAt: new Date('2026-10-15T00:00:00.000Z'),
});

describe('PaymentsService', () => {
  const findByKey = jest.fn<PaymentsRepository['findByKey']>();
  const claim = jest.fn<PaymentsRepository['claim']>();
  const finalize = jest.fn<PaymentsRepository['finalize']>();
  const findOwned = jest.fn<PaymentOrderPort['findOwned']>();
  const applyPaymentResult = jest.fn<PaymentOrderPort['applyPaymentResult']>();
  const charge = jest.fn<PaymentGateway['charge']>();
  const repository = {
    findByKey,
    claim,
    finalize,
  } as unknown as PaymentsRepository;
  const orders: PaymentOrderPort = { findOwned, applyPaymentResult };
  const gateway: PaymentGateway = { charge };
  const service = new PaymentsService(repository, orders, gateway);

  beforeEach(() => {
    jest.clearAllMocks();
    findByKey.mockResolvedValue(null);
    findOwned.mockResolvedValue({
      id: orderId,
      userId,
      total: 98000,
      status: 'PENDING',
    });
    applyPaymentResult.mockResolvedValue(undefined);
    claim.mockResolvedValue({ created: true, payment: payment('PROCESSING') });
    finalize.mockResolvedValue(payment('PAID'));
    charge.mockResolvedValue('PAID');
  });

  it('uses the trusted order total and records a successful payment', async () => {
    await expect(service.pay(userId, input)).resolves.toEqual({
      id: paymentId,
      orderId,
      method: 'CARD',
      status: 'PAID',
      idempotencyKey,
    });
    expect(claim).toHaveBeenCalledWith({
      userId,
      orderId,
      amount: 98000,
      method: 'CARD',
      idempotencyKey,
    });
    expect(charge).toHaveBeenCalledTimes(1);
    expect(applyPaymentResult).toHaveBeenCalledWith({
      orderId,
      userId,
      method: 'CARD',
      status: 'PAID',
    });
  });

  it('replays the stored result without charging the gateway again', async () => {
    findByKey.mockResolvedValue(payment('PAID'));
    await expect(service.pay(userId, input)).resolves.toMatchObject({
      id: paymentId,
      status: 'PAID',
    });
    expect(findOwned).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
    expect(applyPaymentResult).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a key for a different payment request', async () => {
    findByKey.mockResolvedValue(payment('PAID'));
    await expect(
      service.pay(userId, { ...input, method: 'WALLET' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(charge).not.toHaveBeenCalled();
  });

  it('does not charge twice while the first request is processing', async () => {
    findByKey.mockResolvedValue(payment('PROCESSING'));
    await expect(service.pay(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(charge).not.toHaveBeenCalled();
  });

  it('stores UNKNOWN when the mock gateway result cannot be determined', async () => {
    charge.mockRejectedValue(new Error('gateway timeout'));
    finalize.mockResolvedValue(payment('UNKNOWN'));
    await expect(service.pay(userId, input)).resolves.toMatchObject({
      status: 'UNKNOWN',
    });
    expect(finalize).toHaveBeenCalledWith(paymentId, 'UNKNOWN');
    expect(applyPaymentResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'UNKNOWN' }),
    );
  });
});
