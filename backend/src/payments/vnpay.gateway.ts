import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  PaymentGateway,
  VnpayQuery,
  VnpayVerification,
} from './payment.types';

const GMT7_OFFSET_MS = 7 * 60 * 60 * 1000;
const DEFAULT_EXPIRE_MINUTES = 15;
const QUERY_TIMEOUT_MS = 10_000;
const QUERY_RESPONSE_FIELDS = [
  'vnp_ResponseId',
  'vnp_Command',
  'vnp_ResponseCode',
  'vnp_Message',
  'vnp_TmnCode',
  'vnp_TxnRef',
  'vnp_Amount',
  'vnp_BankCode',
  'vnp_PayDate',
  'vnp_TransactionNo',
  'vnp_TransactionType',
  'vnp_TransactionStatus',
  'vnp_OrderInfo',
  'vnp_PromotionCode',
  'vnp_PromotionAmount',
] as const;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ServiceUnavailableException(
      `Cấu hình thanh toán ${name} chưa sẵn sàng`,
    );
  }
  return value;
}

function absoluteHttpUrl(
  name: string,
  fallback?: string,
  httpsOnly = false,
): string {
  const value = process.env[name]?.trim() || fallback;
  try {
    const parsed = new URL(value ?? '');
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      (httpsOnly && parsed.protocol !== 'https:') ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error();
    }
    return parsed.toString();
  } catch {
    throw new ServiceUnavailableException(
      `Cấu hình thanh toán ${name} không hợp lệ`,
    );
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** VNPAY dates use fixed GMT+7 and yyyyMMddHHmmss, without a timezone suffix. */
export function formatVnpayDate(value: Date): string {
  const shifted = new Date(value.getTime() + GMT7_OFFSET_MS);
  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
    pad(shifted.getUTCHours()),
    pad(shifted.getUTCMinutes()),
    pad(shifted.getUTCSeconds()),
  ].join('');
}

/** application/x-www-form-urlencoded encoding is also the signed representation. */
export function formEncode(params: Readonly<Record<string, string>>): string {
  const encode = (value: string) =>
    encodeURIComponent(value).replace(/%20/g, '+');
  return Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key])}`)
    .join('&');
}

function callbackParams(query: VnpayQuery): {
  validShape: boolean;
  params: Record<string, string>;
} {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith('vnp_')) continue;
    if (typeof value !== 'string') return { validShape: false, params };
    params[key] = value;
  }
  return { validShape: true, params };
}

function expireMinutes(): number {
  const raw = process.env.VNPAY_EXPIRE_MINUTES?.trim();
  if (!raw) return DEFAULT_EXPIRE_MINUTES;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 1440) {
    throw new ServiceUnavailableException(
      'Cấu hình thanh toán VNPAY_EXPIRE_MINUTES không hợp lệ',
    );
  }
  return value;
}

function configuredTmnCode(): string {
  const value = required('VNPAY_TMN_CODE');
  if (!/^[A-Za-z0-9]{8}$/.test(value)) {
    throw new ServiceUnavailableException(
      'Cấu hình thanh toán VNPAY_TMN_CODE không hợp lệ',
    );
  }
  return value;
}

function configuredBankCode(): string | undefined {
  const value = process.env.VNPAY_BANK_CODE?.trim();
  if (!value) return undefined;
  if (!/^[A-Za-z0-9]{3,20}$/.test(value)) {
    throw new ServiceUnavailableException(
      'Cáº¥u hÃ¬nh thanh toÃ¡n VNPAY_BANK_CODE khÃ´ng há»£p lá»‡',
    );
  }
  return value;
}

function configuredQueryIpAddress(): string {
  const value = required('VNPAY_QUERY_IP_ADDRESS');
  const parts = value.split('.');
  const octets = parts.map(Number);
  const isIpv4 =
    parts.length === 4 &&
    parts.every(
      (part, index) =>
        /^(0|[1-9]\d{0,2})$/.test(part) && octets[index] <= 255,
    );
  const isPrivateOrLoopback =
    isIpv4 &&
    (octets[0] === 0 ||
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168));
  if (!isIpv4 || isPrivateOrLoopback) {
    throw new ServiceUnavailableException(
      'Cấu hình thanh toán VNPAY_QUERY_IP_ADDRESS phải là IPv4 công khai của backend',
    );
  }
  return value;
}

@Injectable()
export class VnpayGateway implements PaymentGateway {
  createPaymentUrl(input: {
    txnRef: string;
    orderId: string;
    amount: number;
    ipAddress: string;
    now?: Date;
  }) {
    if (
      !Number.isSafeInteger(input.amount) ||
      input.amount <= 0 ||
      !/^[A-Za-z0-9]{1,100}$/.test(input.txnRef)
    ) {
      throw new ServiceUnavailableException(
        'Không thể khởi tạo yêu cầu thanh toán VNPAY',
      );
    }

    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + expireMinutes() * 60_000);
    const amount = input.amount * 100;
    if (!Number.isSafeInteger(amount) || String(amount).length > 12) {
      throw new ServiceUnavailableException('Số tiền thanh toán không hợp lệ');
    }

    const params: Record<string, string> = {
      vnp_Amount: String(amount),
      vnp_Command: 'pay',
      vnp_CreateDate: formatVnpayDate(now),
      vnp_CurrCode: 'VND',
      vnp_ExpireDate: formatVnpayDate(expiresAt),
      vnp_IpAddr: input.ipAddress || '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don hang ${input.txnRef}`,
      vnp_OrderType: '180000',
      vnp_ReturnUrl: absoluteHttpUrl('VNPAY_RETURN_URL'),
      vnp_TmnCode: configuredTmnCode(),
      vnp_TxnRef: input.txnRef,
      vnp_Version: '2.1.0',
    };
    const bankCode = configuredBankCode();
    if (bankCode) params.vnp_BankCode = bankCode;
    const signedData = formEncode(params);
    const secureHash = this.sign(signedData);
    const paymentUrl = absoluteHttpUrl(
      'VNPAY_PAYMENT_URL',
      undefined,
      true,
    );
    const separator = paymentUrl.includes('?') ? '&' : '?';
    return {
      expiresAt,
      paymentUrl: `${paymentUrl}${separator}${signedData}&vnp_SecureHash=${secureHash}`,
    };
  }

  verifyCallback(query: VnpayQuery): VnpayVerification {
    const extracted = callbackParams(query);
    const secureHash = extracted.params.vnp_SecureHash;
    delete extracted.params.vnp_SecureHash;
    delete extracted.params.vnp_SecureHashType;
    if (
      !extracted.validShape ||
      !secureHash ||
      !/^[a-fA-F0-9]{128}$/.test(secureHash)
    ) {
      return { valid: false, params: extracted.params };
    }

    const expected = Buffer.from(this.sign(formEncode(extracted.params)), 'hex');
    const supplied = Buffer.from(secureHash, 'hex');
    return {
      valid:
        expected.length === supplied.length &&
        timingSafeEqual(expected, supplied),
      params: extracted.params,
    };
  }

  async queryTransaction(input: {
    txnRef: string;
    transactionDate: string;
    orderInfo: string;
    now?: Date;
  }): Promise<VnpayVerification> {
    if (
      !/^[A-Za-z0-9]{1,100}$/.test(input.txnRef) ||
      !/^\d{14}$/.test(input.transactionDate) ||
      !input.orderInfo ||
      input.orderInfo.length > 255
    ) {
      throw new ServiceUnavailableException(
        'KhÃ´ng thá»ƒ truy váº¥n giao dá»‹ch VNPAY',
      );
    }

    const params: Record<string, string> = {
      vnp_RequestId: randomBytes(16).toString('hex'),
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: configuredTmnCode(),
      vnp_TxnRef: input.txnRef,
      vnp_TransactionDate: input.transactionDate,
      vnp_CreateDate: formatVnpayDate(input.now ?? new Date()),
      vnp_IpAddr: configuredQueryIpAddress(),
      vnp_OrderInfo: input.orderInfo,
    };
    const requestData = [
      params.vnp_RequestId,
      params.vnp_Version,
      params.vnp_Command,
      params.vnp_TmnCode,
      params.vnp_TxnRef,
      params.vnp_TransactionDate,
      params.vnp_CreateDate,
      params.vnp_IpAddr,
      params.vnp_OrderInfo,
    ].join('|');

    let response: Response;
    try {
      response = await fetch(
        absoluteHttpUrl('VNPAY_QUERY_URL', undefined, true),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...params,
            vnp_SecureHash: this.sign(requestData),
          }),
          signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'KhÃ´ng thá»ƒ káº¿t ná»‘i API truy váº¥n VNPAY',
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'API truy váº¥n VNPAY khÃ´ng sáºµn sÃ ng',
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ServiceUnavailableException(
        'Pháº£n há»“i truy váº¥n VNPAY khÃ´ng há»£p lá»‡',
      );
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ServiceUnavailableException(
        'Pháº£n há»“i truy váº¥n VNPAY khÃ´ng há»£p lá»‡',
      );
    }

    const extracted = callbackParams(body as VnpayQuery);
    const secureHash = extracted.params.vnp_SecureHash;
    delete extracted.params.vnp_SecureHash;
    delete extracted.params.vnp_SecureHashType;
    if (
      !extracted.validShape ||
      !secureHash ||
      !/^[a-fA-F0-9]{128}$/.test(secureHash)
    ) {
      return { valid: false, params: extracted.params };
    }

    const responseData = QUERY_RESPONSE_FIELDS.map(
      (field) => extracted.params[field] ?? '',
    ).join('|');
    const expected = Buffer.from(this.sign(responseData), 'hex');
    const supplied = Buffer.from(secureHash, 'hex');
    return {
      valid:
        expected.length === supplied.length &&
        timingSafeEqual(expected, supplied),
      params: extracted.params,
    };
  }

  isExpectedMerchant(tmnCode: string | undefined): boolean {
    return Boolean(tmnCode) && tmnCode === configuredTmnCode();
  }

  frontendRedirect(path: string): string {
    const target = new URL(
      absoluteHttpUrl(
        'FRONTEND_PUBLIC_URL',
        process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ||
          'http://localhost:3000',
      ),
    );
    target.pathname = path.startsWith('/') ? path : `/${path}`;
    target.search = '';
    target.hash = '';
    return target.toString();
  }

  private sign(data: string): string {
    return createHmac('sha512', required('VNPAY_HASH_SECRET'))
      .update(data, 'utf8')
      .digest('hex');
  }
}
