import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import {
  formEncode,
  formatVnpayDate,
  VnpayGateway,
} from './vnpay.gateway';

describe('VnpayGateway WebPay 2.1.0', () => {
  const saved = Object.fromEntries(
    [
      'VNPAY_TMN_CODE',
      'VNPAY_HASH_SECRET',
      'VNPAY_PAYMENT_URL',
      'VNPAY_QUERY_URL',
      'VNPAY_QUERY_IP_ADDRESS',
      'VNPAY_RETURN_URL',
      'VNPAY_BANK_CODE',
      'VNPAY_EXPIRE_MINUTES',
      'FRONTEND_PUBLIC_URL',
    ].map((key) => [key, process.env[key]]),
  );
  const secret = 'test-secret-that-never-leaves-the-backend';
  const gateway = new VnpayGateway();

  beforeAll(() => {
    process.env.VNPAY_TMN_CODE = 'BREWTEST';
    process.env.VNPAY_HASH_SECRET = secret;
    process.env.VNPAY_PAYMENT_URL =
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    process.env.VNPAY_QUERY_URL =
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
    process.env.VNPAY_QUERY_IP_ADDRESS = '127.0.0.1';
    process.env.VNPAY_RETURN_URL =
      'https://api.example.test/api/payments/vnpay/return';
    delete process.env.VNPAY_BANK_CODE;
    process.env.VNPAY_EXPIRE_MINUTES = '15';
    process.env.FRONTEND_PUBLIC_URL = 'https://coffee.example.test';
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('uses form encoding and formats all dates in GMT+7', () => {
    expect(
      formEncode({
        vnp_ReturnUrl: 'https://merchant.test/return?a=one two',
        vnp_OrderInfo: "Thanh toan: #1 ~!'()*",
      }),
    ).toBe(
      "vnp_OrderInfo=Thanh+toan%3A+%231+~!'()*&vnp_ReturnUrl=https%3A%2F%2Fmerchant.test%2Freturn%3Fa%3Done+two",
    );
    expect(formatVnpayDate(new Date('2026-10-21T17:30:05.000Z'))).toBe(
      '20261022003005',
    );
  });

  it('builds a signed WebPay 2.1.0 URL with amount multiplied by 100', () => {
    const result = gateway.createPaymentUrl({
      txnRef: '0123456789abcdef0123456789abcdef',
      orderId: '21a650c7-8597-4a01-a8e2-000000000001',
      amount: 98000,
      ipAddress: '203.0.113.8',
      now: new Date('2026-10-21T03:00:00.000Z'),
    });
    expect(result.expiresAt.toISOString()).toBe('2026-10-21T03:15:00.000Z');
    const url = new URL(result.paymentUrl);
    expect(url.origin + url.pathname).toBe(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: 'BREWTEST',
      vnp_Amount: '9800000',
      vnp_CurrCode: 'VND',
      vnp_CreateDate: '20261021100000',
      vnp_ExpireDate: '20261021101500',
      vnp_OrderInfo:
        'Thanh toan don hang 0123456789abcdef0123456789abcdef',
      vnp_ReturnUrl:
        'https://api.example.test/api/payments/vnpay/return',
      vnp_TxnRef: '0123456789abcdef0123456789abcdef',
    });
    expect(url.searchParams.has('vnp_BankCode')).toBe(false);
    expect(url.searchParams.has('vnp_SecureHashType')).toBe(false);

    const unsigned = Object.fromEntries(
      [...url.searchParams.entries()].filter(
        ([key]) => key !== 'vnp_SecureHash',
      ),
    );
    const expected = createHmac('sha512', secret)
      .update(formEncode(unsigned), 'utf8')
      .digest('hex');
    expect(url.searchParams.get('vnp_SecureHash')).toBe(expected);
  });

  it('uses an explicitly configured VNPAY payment channel', () => {
    process.env.VNPAY_BANK_CODE = 'VNPAYQR';
    const result = gateway.createPaymentUrl({
      txnRef: '1123456789abcdef0123456789abcdef',
      orderId: '21a650c7-8597-4a01-a8e2-000000000001',
      amount: 98000,
      ipAddress: '203.0.113.8',
      now: new Date('2026-10-21T03:00:00.000Z'),
    });
    expect(new URL(result.paymentUrl).searchParams.get('vnp_BankCode')).toBe(
      'VNPAYQR',
    );
    delete process.env.VNPAY_BANK_CODE;
  });

  it('rejects an invalid configured payment channel', () => {
    process.env.VNPAY_BANK_CODE = 'QR!';
    expect(() =>
      gateway.createPaymentUrl({
        txnRef: '2123456789abcdef0123456789abcdef',
        orderId: '21a650c7-8597-4a01-a8e2-000000000001',
        amount: 98000,
        ipAddress: '203.0.113.8',
      }),
    ).toThrow('VNPAY_BANK_CODE');
    delete process.env.VNPAY_BANK_CODE;
  });

  it('verifies signed callback fields and rejects tampering or duplicate values', () => {
    const params = {
      vnp_Amount: '9800000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'BREWTEST',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: '0123456789abcdef0123456789abcdef',
    };
    const vnp_SecureHash = createHmac('sha512', secret)
      .update(formEncode(params), 'utf8')
      .digest('hex');
    expect(gateway.verifyCallback({ ...params, vnp_SecureHash })).toEqual({
      valid: true,
      params,
    });
    expect(
      gateway.verifyCallback({
        ...params,
        vnp_Amount: '1',
        vnp_SecureHash,
      }).valid,
    ).toBe(false);
    expect(
      gateway.verifyCallback({
        ...params,
        vnp_TxnRef: [params.vnp_TxnRef, 'duplicate'],
        vnp_SecureHash,
      }).valid,
    ).toBe(false);
  });

  it('always builds redirects from the configured frontend URL', () => {
    process.env.FRONTEND_PUBLIC_URL =
      'https://coffee.example.test/ignored?redirect=https://evil.test';
    expect(gateway.frontendRedirect('/payment/order-id/verifying')).toBe(
      'https://coffee.example.test/payment/order-id/verifying',
    );
  });

  it('queries VNPAY with the documented pipe checksum and verifies its response', async () => {
    const responseParams = {
      vnp_ResponseId: 'response-id',
      vnp_Command: 'querydr',
      vnp_ResponseCode: '00',
      vnp_Message: 'Success',
      vnp_TmnCode: 'BREWTEST',
      vnp_TxnRef: '0123456789abcdef0123456789abcdef',
      vnp_Amount: '9800000',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261021100100',
      vnp_TransactionNo: '12345',
      vnp_TransactionType: '01',
      vnp_TransactionStatus: '00',
      vnp_OrderInfo: 'Thanh toan don hang',
    };
    const responseData = [
      responseParams.vnp_ResponseId,
      responseParams.vnp_Command,
      responseParams.vnp_ResponseCode,
      responseParams.vnp_Message,
      responseParams.vnp_TmnCode,
      responseParams.vnp_TxnRef,
      responseParams.vnp_Amount,
      responseParams.vnp_BankCode,
      responseParams.vnp_PayDate,
      responseParams.vnp_TransactionNo,
      responseParams.vnp_TransactionType,
      responseParams.vnp_TransactionStatus,
      responseParams.vnp_OrderInfo,
      '',
      '',
    ].join('|');
    const vnp_SecureHash = createHmac('sha512', secret)
      .update(responseData, 'utf8')
      .digest('hex');
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ ...responseParams, vnp_SecureHash }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    global.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        gateway.queryTransaction({
          txnRef: responseParams.vnp_TxnRef,
          transactionDate: '20261021100000',
          orderInfo: 'Truy van giao dich',
          now: new Date('2026-10-21T03:05:00.000Z'),
        }),
      ).resolves.toEqual({ valid: true, params: responseParams });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      );
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      expect(body).toMatchObject({
        vnp_Version: '2.1.0',
        vnp_Command: 'querydr',
        vnp_TmnCode: 'BREWTEST',
        vnp_TxnRef: responseParams.vnp_TxnRef,
        vnp_TransactionDate: '20261021100000',
        vnp_CreateDate: '20261021100500',
        vnp_IpAddr: '127.0.0.1',
        vnp_OrderInfo: 'Truy van giao dich',
      });
      const requestData = [
        body.vnp_RequestId,
        body.vnp_Version,
        body.vnp_Command,
        body.vnp_TmnCode,
        body.vnp_TxnRef,
        body.vnp_TransactionDate,
        body.vnp_CreateDate,
        body.vnp_IpAddr,
        body.vnp_OrderInfo,
      ].join('|');
      expect(body.vnp_SecureHash).toBe(
        createHmac('sha512', secret)
          .update(requestData, 'utf8')
          .digest('hex'),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('rejects a tampered QueryDR response signature', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            vnp_ResponseId: 'response-id',
            vnp_Command: 'querydr',
            vnp_ResponseCode: '00',
            vnp_Message: 'Success',
            vnp_TmnCode: 'BREWTEST',
            vnp_TxnRef: '0123456789abcdef0123456789abcdef',
            vnp_Amount: '1',
            vnp_BankCode: 'NCB',
            vnp_PayDate: '20261021100100',
            vnp_TransactionNo: '12345',
            vnp_TransactionType: '01',
            vnp_TransactionStatus: '00',
            vnp_OrderInfo: 'Thanh toan don hang',
            vnp_SecureHash: 'a'.repeat(128),
          }),
          { status: 200 },
        ),
      ),
    ) as typeof fetch;
    try {
      await expect(
        gateway.queryTransaction({
          txnRef: '0123456789abcdef0123456789abcdef',
          transactionDate: '20261021100000',
          orderInfo: 'Truy van giao dich',
        }),
      ).resolves.toMatchObject({ valid: false });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('refuses a non-HTTPS VNPAY payment endpoint', () => {
    process.env.VNPAY_PAYMENT_URL = 'http://sandbox.vnpayment.vn/pay';
    expect(() =>
      gateway.createPaymentUrl({
        txnRef: '0123456789abcdef0123456789abcdef',
        orderId: '21a650c7-8597-4a01-a8e2-000000000001',
        amount: 98000,
        ipAddress: '127.0.0.1',
      }),
    ).toThrow('VNPAY_PAYMENT_URL');
  });
});
