import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { PaymentGateway, PaymentOrderPort } from './payment.types';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

const userId = '11a650c7-8597-4a01-a8e2-000000000001';
const orderId = '21a650c7-8597-4a01-a8e2-000000000001';
const paymentId = '31a650c7-8597-4a01-a8e2-000000000001';
const idempotencyKey = '41a650c7-8597-4a01-a8e2-000000000001';
const expiresAt = new Date('2026-10-21T03:15:00.000Z');
const input: CreatePaymentDto = {
  orderId,
  method: 'VNPAY_QR',
  idempotencyKey,
};

function payment(status: Payment['status'] = 'PROCESSING'): Payment {
  return {
    id: paymentId,
    userId,
    orderId,
    amount: 98000,
    method: 'VNPAY_QR',
    status,
    idempotencyKey,
    vnpTxnRef: '0123456789abcdef0123456789abcdef',
    paymentUrl:
      'https://sandbox.vnpayment.vn/pay?vnp_CreateDate=20261021100000&vnp_OrderInfo=Thanh+toan+don+hang+0123456789abcdef0123456789abcdef&vnp_TxnRef=0123456789abcdef0123456789abcdef&vnp_SecureHash=signed',
    expiresAt,
    vnpTransactionNo: null,
    vnpResponseCode: null,
    vnpTransactionStatus: null,
    vnpBankCode: null,
    vnpCardType: null,
    vnpPayDate: null,
    processedAt: null,
    createdAt: new Date('2026-10-21T03:00:00.000Z'),
    updatedAt: new Date('2026-10-21T03:00:00.000Z'),
  };
}

describe('PaymentsService VNPAY flow', () => {
  const tx = {} as Prisma.TransactionClient;
  const findByKey = jest.fn<PaymentsRepository['findByKey']>();
  const findByTxnRef = jest.fn<PaymentsRepository['findByTxnRef']>();
  const findLatestForOwnedOrder =
    jest.fn<PaymentsRepository['findLatestForOwnedOrder']>();
  const create = jest.fn<PaymentsRepository['create']>();
  const conditionalFinalize =
    jest.fn<PaymentsRepository['conditionalFinalize']>();
  const isUniqueViolation =
    jest.fn<PaymentsRepository['isUniqueViolation']>();
  const transaction = jest.fn<PaymentsRepository['transaction']>();
  const repository = {
    findByKey,
    findByTxnRef,
    findLatestForOwnedOrder,
    create,
    conditionalFinalize,
    isUniqueViolation,
    transaction,
  } as unknown as PaymentsRepository;

  const findOwned = jest.fn<PaymentOrderPort['findOwned']>();
  const prepareRetry = jest.fn<PaymentOrderPort['prepareRetry']>();
  const applyPaymentResult = jest.fn<PaymentOrderPort['applyPaymentResult']>();
  const orders: PaymentOrderPort = {
    findOwned,
    prepareRetry,
    applyPaymentResult,
  };

  const createPaymentUrl = jest.fn<PaymentGateway['createPaymentUrl']>();
  const verifyCallback = jest.fn<PaymentGateway['verifyCallback']>();
  const queryTransaction = jest.fn<PaymentGateway['queryTransaction']>();
  const isExpectedMerchant = jest.fn<PaymentGateway['isExpectedMerchant']>();
  const frontendRedirect = jest.fn<PaymentGateway['frontendRedirect']>();
  const gateway: PaymentGateway = {
    createPaymentUrl,
    verifyCallback,
    queryTransaction,
    isExpectedMerchant,
    frontendRedirect,
  };
  const service = new PaymentsService(repository, orders, gateway);

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockImplementation(async (work) => work(tx));
    findByKey.mockResolvedValue(null);
    findOwned.mockResolvedValue({
      id: orderId,
      userId,
      total: 98000,
      status: 'PENDING',
    });
    prepareRetry.mockResolvedValue({
      id: orderId,
      userId,
      total: 98000,
      status: 'PENDING',
    });
    createPaymentUrl.mockReturnValue({
      paymentUrl: payment().paymentUrl!,
      expiresAt,
    });
    create.mockResolvedValue(payment());
    findLatestForOwnedOrder.mockResolvedValue(payment());
    conditionalFinalize.mockResolvedValue({ count: 1 });
    isUniqueViolation.mockReturnValue(false);
    applyPaymentResult.mockResolvedValue(undefined);
    isExpectedMerchant.mockReturnValue(true);
    frontendRedirect.mockImplementation((path) => `https://shop.test${path}`);
    queryTransaction.mockResolvedValue({
      valid: true,
      params: {
        vnp_Command: 'querydr',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '9800000',
        vnp_TransactionType: '01',
        vnp_TransactionStatus: '00',
        vnp_TransactionNo: '12345',
        vnp_BankCode: 'NCB',
        vnp_PayDate: '20261021100100',
      },
    });
  });

  it('creates and persists a PROCESSING URL using the trusted order amount', async () => {
    await expect(service.pay(userId, input, '203.0.113.8')).resolves.toEqual({
      id: paymentId,
      orderId,
      method: 'VNPAY_QR',
      status: 'PROCESSING',
      idempotencyKey,
      paymentUrl: payment().paymentUrl,
      expiresAt: expiresAt.toISOString(),
    });
    expect(findOwned).toHaveBeenCalledWith(orderId, userId, tx);
    expect(createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        amount: 98000,
        ipAddress: '203.0.113.8',
        txnRef: expect.stringMatching(/^[a-f0-9]{32}$/),
      }),
    );
    expect(create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId,
        orderId,
        amount: 98000,
        method: 'VNPAY_QR',
        idempotencyKey,
        paymentUrl: payment().paymentUrl,
        expiresAt,
      }),
    );
    expect(applyPaymentResult).not.toHaveBeenCalled();
  });

  it('replays the same PROCESSING payment and URL without signing again', async () => {
    findByKey.mockResolvedValue(payment());
    await expect(service.pay(userId, input, '127.0.0.1')).resolves.toMatchObject({
      id: paymentId,
      status: 'PROCESSING',
      paymentUrl: payment().paymentUrl,
    });
    expect(findOwned).not.toHaveBeenCalled();
    expect(createPaymentUrl).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key for another request', async () => {
    findByKey.mockResolvedValue({ ...payment(), orderId: randomUUID() });
    await expect(service.pay(userId, input, '127.0.0.1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reserves a failed order before building its retry URL', async () => {
    findOwned.mockResolvedValue({
      id: orderId,
      userId,
      total: 98000,
      status: 'PAYMENT_FAILED',
    });
    await service.pay(userId, input, '127.0.0.1');
    expect(prepareRetry).toHaveBeenCalledWith(orderId, userId, tx);
    expect(prepareRetry.mock.invocationCallOrder[0]).toBeLessThan(
      createPaymentUrl.mock.invocationCallOrder[0],
    );
  });

  it('maps an active-payment uniqueness race to 409', async () => {
    const uniqueError = new Error('unique');
    transaction.mockRejectedValue(uniqueError);
    isUniqueViolation.mockImplementation((error) => error === uniqueError);
    findByKey.mockResolvedValue(null);
    await expect(service.pay(userId, input, '127.0.0.1')).rejects.toMatchObject({
      status: 409,
    });
  });

  it.each([
    { error: new Error('unique'), unique: true },
    { error: new ConflictException('order CAS race'), unique: false },
  ])(
    'replays a concurrent request that won an idempotency race %#',
    async ({ error, unique }) => {
      transaction.mockRejectedValue(error);
      isUniqueViolation.mockReturnValue(unique);
      findByKey.mockResolvedValue(payment());
      await expect(
        service.pay(userId, input, '127.0.0.1'),
      ).resolves.toMatchObject({
        id: paymentId,
        status: 'PROCESSING',
      });
    },
  );

  it('uses official IPN response codes before any mutation', async () => {
    verifyCallback.mockReturnValue({ valid: false, params: {} });
    await expect(service.handleIpn({})).resolves.toEqual({
      RspCode: '97',
      Message: 'Invalid checksum',
    });
    expect(transaction).not.toHaveBeenCalled();

    verifyCallback.mockReturnValue({
      valid: true,
      params: {
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: 'missing',
        vnp_Amount: '9800000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      },
    });
    findByTxnRef.mockResolvedValue(null);
    await expect(service.handleIpn({})).resolves.toEqual({
      RspCode: '01',
      Message: 'Order not found',
    });

    isExpectedMerchant.mockImplementation(() => {
      throw new Error('missing merchant configuration');
    });
    await expect(service.handleIpn({})).resolves.toEqual({
      RspCode: '99',
      Message: 'Unknown error',
    });
  });

  it('conditionally finalizes Payment and Order in the same IPN transaction', async () => {
    verifyCallback.mockReturnValue({
      valid: true,
      params: {
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '9800000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_TransactionNo: '12345',
      },
    });
    findByTxnRef.mockResolvedValue(payment());
    await expect(service.handleIpn({})).resolves.toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });
    expect(conditionalFinalize).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: paymentId, status: 'PAID' }),
    );
    expect(applyPaymentResult).toHaveBeenCalledWith(
      { orderId, userId, method: 'VNPAY_QR', status: 'PAID' },
      tx,
    );
  });

  it('maps a final VNPAY failure and reports duplicate IPNs as confirmed', async () => {
    verifyCallback.mockReturnValue({
      valid: true,
      params: {
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '9800000',
        vnp_ResponseCode: '24',
        vnp_TransactionStatus: '02',
      },
    });
    findByTxnRef.mockResolvedValueOnce(payment());
    await expect(service.handleIpn({})).resolves.toMatchObject({ RspCode: '00' });
    expect(applyPaymentResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAYMENT_FAILED' }),
      tx,
    );

    findByTxnRef.mockResolvedValueOnce(payment('PAID'));
    await expect(service.handleIpn({})).resolves.toEqual({
      RspCode: '02',
      Message: 'Order already confirmed',
    });
  });

  it('does not finalize IPN states that may still represent a debit or manual review', async () => {
    findByTxnRef.mockResolvedValue(payment());
    for (const [responseCode, transactionStatus] of [
      ['00', '01'],
      ['00', '04'],
      ['00', '07'],
      ['07', '02'],
      ['00', '10'],
      ['00', '20'],
    ] as const) {
      verifyCallback.mockReturnValue({
        valid: true,
        params: {
          vnp_TmnCode: 'BREWTEST',
          vnp_TxnRef: payment().vnpTxnRef!,
          vnp_Amount: '9800000',
          vnp_ResponseCode: responseCode,
          vnp_TransactionStatus: transactionStatus,
        },
      });
      await expect(service.handleIpn({})).resolves.toEqual({
        RspCode: '99',
        Message: 'Unknown error',
      });
    }
    expect(conditionalFinalize).not.toHaveBeenCalled();
    expect(applyPaymentResult).not.toHaveBeenCalled();
  });

  it('lets only one concurrent IPN pass the conditional finalization', async () => {
    verifyCallback.mockReturnValue({
      valid: true,
      params: {
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '9800000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      },
    });
    findByTxnRef.mockResolvedValue(payment());
    conditionalFinalize.mockResolvedValue({ count: 0 });
    await expect(service.handleIpn({})).resolves.toEqual({
      RspCode: '02',
      Message: 'Order already confirmed',
    });
    expect(applyPaymentResult).not.toHaveBeenCalled();
  });

  it('rejects a mismatched amount and converts transaction failures to 99', async () => {
    verifyCallback.mockReturnValue({
      valid: true,
      params: {
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '1',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      },
    });
    findByTxnRef.mockResolvedValue(payment());
    await expect(service.handleIpn({})).resolves.toEqual({
      RspCode: '04',
      Message: 'Invalid amount',
    });

    verifyCallback.mockReturnValue({
      valid: true,
      params: {
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '9800000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      },
    });
    applyPaymentResult.mockRejectedValue(new ConflictException('race'));
    await expect(service.handleIpn({})).resolves.toEqual({
      RspCode: '99',
      Message: 'Unknown error',
    });
  });

  it('return verifies reference and amount, redirects, and never finalizes', async () => {
    verifyCallback.mockReturnValue({
      valid: true,
      params: {
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '9800000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      },
    });
    findByTxnRef.mockResolvedValue(payment());
    await expect(service.handleReturn({})).resolves.toBe(
      `https://shop.test/payment/${orderId}/verifying`,
    );
    expect(conditionalFinalize).not.toHaveBeenCalled();
    expect(applyPaymentResult).not.toHaveBeenCalled();

    verifyCallback.mockReturnValue({
      valid: true,
      params: {
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '9800000',
        vnp_ResponseCode: '24',
        vnp_TransactionStatus: '02',
      },
    });
    await expect(service.handleReturn({})).resolves.toBe(
      `https://shop.test/payment/${orderId}/unknown`,
    );
    expect(conditionalFinalize).not.toHaveBeenCalled();
    expect(applyPaymentResult).not.toHaveBeenCalled();

    verifyCallback.mockReturnValue({ valid: false, params: {} });
    await expect(service.handleReturn({})).resolves.toBe(
      'https://shop.test/payment/error',
    );
  });

  it('reconciles a signed successful QueryDR result atomically', async () => {
    findByTxnRef
      .mockResolvedValueOnce(payment())
      .mockResolvedValueOnce(payment('PAID'));

    await expect(service.reconcile(userId, orderId)).resolves.toMatchObject({
      id: paymentId,
      status: 'PAID',
    });
    expect(queryTransaction).toHaveBeenCalledWith({
      txnRef: payment().vnpTxnRef,
      transactionDate: '20261021100000',
      orderInfo:
        'Thanh toan don hang 0123456789abcdef0123456789abcdef',
    });
    expect(conditionalFinalize).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        id: paymentId,
        status: 'PAID',
        transactionNo: '12345',
        bankCode: 'NCB',
      }),
    );
    expect(applyPaymentResult).toHaveBeenCalledWith(
      { orderId, userId, method: 'VNPAY_QR', status: 'PAID' },
      tx,
    );
  });

  it('does not mutate on QueryDR throttling or a non-final status', async () => {
    queryTransaction.mockResolvedValueOnce({
      valid: true,
      params: { vnp_ResponseCode: '94' },
    });
    await expect(service.reconcile(userId, orderId)).resolves.toMatchObject({
      status: 'PROCESSING',
    });

    for (const transactionStatus of ['01', '04', '07', '10', '20']) {
      queryTransaction.mockResolvedValueOnce({
        valid: true,
        params: {
          vnp_Command: 'querydr',
          vnp_ResponseCode: '00',
          vnp_TmnCode: 'BREWTEST',
          vnp_TxnRef: payment().vnpTxnRef!,
          vnp_Amount: '9800000',
          vnp_TransactionType: '01',
          vnp_TransactionStatus: transactionStatus,
        },
      });
      await expect(service.reconcile(userId, orderId)).resolves.toMatchObject({
        status: 'PROCESSING',
      });
    }
    expect(conditionalFinalize).not.toHaveBeenCalled();
    expect(applyPaymentResult).not.toHaveBeenCalled();
  });

  it('finalizes an expired or cancelled signed QueryDR transaction as failed', async () => {
    queryTransaction.mockResolvedValueOnce({
      valid: true,
      params: {
        vnp_Command: 'querydr',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '9800000',
        vnp_TransactionType: '01',
        vnp_TransactionStatus: '11',
      },
    });
    findByTxnRef
      .mockResolvedValueOnce(payment())
      .mockResolvedValueOnce(payment('PAYMENT_FAILED'));

    await expect(service.reconcile(userId, orderId)).resolves.toMatchObject({
      status: 'PAYMENT_FAILED',
    });
    expect(conditionalFinalize).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ status: 'PAYMENT_FAILED' }),
    );
    expect(applyPaymentResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAYMENT_FAILED' }),
      tx,
    );
  });

  it('rejects a tampered or mismatched QueryDR result without mutation', async () => {
    queryTransaction.mockResolvedValueOnce({ valid: false, params: {} });
    await expect(service.reconcile(userId, orderId)).rejects.toMatchObject({
      status: 503,
    });

    queryTransaction.mockResolvedValueOnce({
      valid: true,
      params: {
        vnp_Command: 'querydr',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: payment().vnpTxnRef!,
        vnp_Amount: '1',
        vnp_TransactionType: '01',
        vnp_TransactionStatus: '00',
      },
    });
    await expect(service.reconcile(userId, orderId)).rejects.toMatchObject({
      status: 503,
    });
    expect(conditionalFinalize).not.toHaveBeenCalled();
    expect(applyPaymentResult).not.toHaveBeenCalled();
  });
});
