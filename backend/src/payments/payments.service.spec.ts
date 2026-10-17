import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import type { PaymentGateway, PaymentOrderPort } from './payment.types';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

const userId = '11a650c7-8597-4a01-a8e2-000000000001';
const orderId = '21a650c7-8597-4a01-a8e2-000000000001';
const paymentId = '31a650c7-8597-4a01-a8e2-000000000001';
const input = {
  orderId,
  method: 'CARD' as const,
  idempotencyKey: '41a650c7-8597-4a01-a8e2-000000000001',
};
const payment = (
  status: Payment['status'],
  gatewayStatus: Payment['gatewayStatus'] = null,
): Payment => ({
  id: paymentId,
  userId,
  orderId,
  amount: 98000,
  method: 'CARD',
  status,
  idempotencyKey: input.idempotencyKey,
  gatewayStatus,
  appliedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('PaymentsService orchestration (PostgreSQL behavior tested separately)', () => {
  const tx = {} as Prisma.TransactionClient;
  const findByKey = jest.fn<PaymentsRepository['findByKey']>();
  const findBlockingAttempt =
    jest.fn<PaymentsRepository['findBlockingAttempt']>();
  const claim = jest.fn<PaymentsRepository['claim']>();
  const recordGatewayResult =
    jest.fn<PaymentsRepository['recordGatewayResult']>();
  const finalize = jest.fn<PaymentsRepository['finalize']>();
  const prepareAttempt = jest.fn<PaymentOrderPort['prepareAttempt']>();
  const findOwned = jest.fn<PaymentOrderPort['findOwned']>();
  const applyPaymentResult = jest.fn<PaymentOrderPort['applyPaymentResult']>();
  const charge = jest.fn<PaymentGateway['charge']>();
  const repository = {
    withOrderLock: async <T>(
      _orderId: string,
      _userId: string,
      work: (client: Prisma.TransactionClient) => Promise<T>,
    ) => work(tx),
    findByKey,
    findBlockingAttempt,
    claim,
    recordGatewayResult,
    finalize,
  } as unknown as PaymentsRepository;
  const service = new PaymentsService(
    repository,
    { findOwned, prepareAttempt, applyPaymentResult },
    { charge },
  );

  beforeEach(() => {
    jest.resetAllMocks();
    findByKey
      .mockResolvedValueOnce(null)
      .mockResolvedValue(payment('PROCESSING', 'PAID'));
    findBlockingAttempt.mockResolvedValue(null);
    prepareAttempt.mockResolvedValue({
      id: orderId,
      userId,
      total: 98000,
      status: 'PENDING',
    });
    claim.mockResolvedValue(payment('PROCESSING'));
    recordGatewayResult.mockResolvedValue(undefined);
    finalize.mockResolvedValue(payment('PAID', 'PAID'));
    applyPaymentResult.mockResolvedValue(undefined);
    charge.mockResolvedValue('PAID');
  });

  it('charges the server amount outside the claim and passes one shared tx to apply/finalize', async () => {
    expect((await service.pay(userId, input)).status).toBe('PAID');
    expect(charge).toHaveBeenCalledWith({
      orderId,
      amount: 98000,
      method: 'CARD',
      idempotencyKey: paymentId,
    });
    expect(prepareAttempt).toHaveBeenCalledWith({ orderId, userId }, tx);
    expect(applyPaymentResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAID' }),
      tx,
    );
    expect(finalize).toHaveBeenCalledWith(paymentId, 'PAID', tx);
  });

  it('returns a final stored result without charging or applying points again', async () => {
    findByKey.mockReset().mockResolvedValue(payment('PAID', 'PAID'));
    expect((await service.pay(userId, input)).status).toBe('PAID');
    expect(charge).not.toHaveBeenCalled();
    expect(applyPaymentResult).not.toHaveBeenCalled();
    expect(prepareAttempt).not.toHaveBeenCalled();
  });

  it.each([{ method: 'WALLET' as const }, { orderId: 'different-order' }])(
    'rejects a key reused for different request %j',
    async (patch) => {
      findByKey.mockReset().mockResolvedValue(payment('PAID', 'PAID'));
      await expect(
        service.pay(userId, { ...input, ...patch }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(charge).not.toHaveBeenCalled();
    },
  );

  it('blocks an unfinished attempt without a journal', async () => {
    findByKey.mockReset().mockResolvedValue(payment('PROCESSING'));
    await expect(service.pay(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(charge).not.toHaveBeenCalled();
  });

  it('recovers a journaled result without calling the gateway', async () => {
    findByKey.mockReset().mockResolvedValue(payment('PROCESSING', 'PAID'));
    expect((await service.pay(userId, input)).status).toBe('PAID');
    expect(charge).not.toHaveBeenCalled();
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it('blocks new keys while another attempt is unresolved', async () => {
    findBlockingAttempt.mockResolvedValue(payment('UNKNOWN', 'UNKNOWN'));
    await expect(service.pay(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prepareAttempt).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
  });

  it('journals timeout as UNKNOWN before settling it', async () => {
    charge.mockRejectedValue(new Error('gateway timeout'));
    findByKey
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(payment('PROCESSING', 'UNKNOWN'));
    finalize.mockResolvedValue(payment('UNKNOWN', 'UNKNOWN'));
    expect((await service.pay(userId, input)).status).toBe('UNKNOWN');
    expect(recordGatewayResult).toHaveBeenCalledWith(paymentId, 'UNKNOWN');
    expect(applyPaymentResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'UNKNOWN' }),
      tx,
    );
  });
});
