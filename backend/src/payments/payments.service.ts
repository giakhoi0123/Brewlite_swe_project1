import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PAYMENT_GATEWAY,
  PAYMENT_ORDER_PORT,
  type PaymentFinalStatus,
  type PaymentGateway,
  type PaymentOrderPort,
  type VnpayIpnResponse,
  type VnpayQuery,
} from './payment.types';
import { PaymentsRepository } from './payments.repository';

const IPN_RESPONSE = {
  success: { RspCode: '00', Message: 'Confirm Success' },
  notFound: { RspCode: '01', Message: 'Order not found' },
  confirmed: { RspCode: '02', Message: 'Order already confirmed' },
  invalidAmount: { RspCode: '04', Message: 'Invalid amount' },
  invalidChecksum: { RspCode: '97', Message: 'Invalid checksum' },
  error: { RspCode: '99', Message: 'Unknown error' },
} as const satisfies Record<string, VnpayIpnResponse>;

// The public PAY/QueryDR contract defines only 00 as payment success. Later
// lifecycle codes such as delivered/settled stay manual-review here rather
// than being allowed to fulfil an order from an unexpected callback.
const PAID_TRANSACTION_STATUSES = new Set(['00']);
const FAILED_TRANSACTION_STATUSES = new Set(['02', '08', '11']);
const CLEAR_IPN_FAILURE_RESPONSE_CODES = new Set([
  '09',
  '10',
  '11',
  '12',
  '13',
  '24',
  '51',
  '65',
  '75',
  '79',
]);

/**
 * VNPAY has non-terminal/manual-review states (for example reversal and
 * suspected fraud). They must remain PROCESSING so the customer cannot start
 * a second charge while the first debit may still exist.
 */
function classifyFinalStatus(
  params: Readonly<Record<string, string>>,
  source: 'ipn' | 'querydr',
): PaymentFinalStatus | null {
  const responseCode = params.vnp_ResponseCode;
  const transactionStatus = params.vnp_TransactionStatus;

  if (
    responseCode === '00' &&
    transactionStatus &&
    PAID_TRANSACTION_STATUSES.has(transactionStatus)
  ) {
    return 'PAID';
  }

  if (!transactionStatus || !FAILED_TRANSACTION_STATUSES.has(transactionStatus)) {
    return null;
  }

  // QueryDR's response code describes whether the query itself succeeded;
  // the signed transaction status carries the payment result.
  if (source === 'querydr') return 'PAYMENT_FAILED';

  // 08 (expired) and 11 (cancelled) are explicit terminal transaction states.
  if (transactionStatus === '08' || transactionStatus === '11') {
    return 'PAYMENT_FAILED';
  }

  // Status 02 is only safe to retry when the detailed IPN response is a
  // documented, unambiguous payment failure. In particular, response 07
  // means the customer may already have been debited and needs manual review.
  return CLEAR_IPN_FAILURE_RESPONSE_CODES.has(responseCode)
    ? 'PAYMENT_FAILED'
    : null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly payments: PaymentsRepository,
    @Inject(PAYMENT_ORDER_PORT) private readonly orders: PaymentOrderPort,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async pay(userId: string, input: CreatePaymentDto, ipAddress: string) {
    try {
      const payment = await this.payments.transaction(async (tx) => {
        const existing = await this.payments.findByKey(
          userId,
          input.idempotencyKey,
          tx,
        );
        if (existing) return this.assertReplay(existing, input);

        let order = await this.orders.findOwned(input.orderId, userId, tx);
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
        if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status)) {
          throw new ConflictException('Đơn hàng không thể thanh toán');
        }

        // Retry inventory must be reserved before a usable VNPAY URL exists.
        // The transition and Payment insert share this transaction, so any
        // configuration/signing/uniqueness failure rolls the reservation back.
        if (order.status === 'PAYMENT_FAILED') {
          order = await this.orders.prepareRetry(order.id, userId, tx);
        }

        const vnpTxnRef = randomBytes(16).toString('hex');
        const session = this.gateway.createPaymentUrl({
          txnRef: vnpTxnRef,
          orderId: order.id,
          amount: order.total,
          ipAddress,
        });
        return this.payments.create(tx, {
          userId,
          orderId: order.id,
          amount: order.total,
          method: input.method,
          idempotencyKey: input.idempotencyKey,
          vnpTxnRef,
          paymentUrl: session.paymentUrl,
          expiresAt: session.expiresAt,
        });
      });
      return this.toResponse(payment);
    } catch (error) {
      const uniqueViolation = this.payments.isUniqueViolation(error);
      const idempotencyRace =
        uniqueViolation || error instanceof ConflictException;
      if (!idempotencyRace) throw error;

      // A concurrent request may have committed the same idempotency key.
      // Retry races can lose the Order CAS before reaching Payment.create,
      // so ConflictException is also checked for an idempotent winner.
      const existing = await this.payments.findByKey(
        userId,
        input.idempotencyKey,
      );
      if (existing) return this.toResponse(this.assertReplay(existing, input));
      if (uniqueViolation) {
        throw new ConflictException(
          'Đơn hàng đã có một giao dịch đang xử lý hoặc đã thanh toán',
        );
      }
      throw error;
    }
  }

  async handleIpn(query: VnpayQuery): Promise<VnpayIpnResponse> {
    let verification;
    try {
      verification = this.gateway.verifyCallback(query);
    } catch {
      return IPN_RESPONSE.error;
    }
    if (!verification.valid) return IPN_RESPONSE.invalidChecksum;
    const params = verification.params;
    try {
      if (!this.gateway.isExpectedMerchant(params.vnp_TmnCode)) {
        return IPN_RESPONSE.error;
      }
    } catch {
      return IPN_RESPONSE.error;
    }
    if (
      !/^[0-9]{2}$/.test(params.vnp_ResponseCode ?? '') ||
      !/^[0-9]{2}$/.test(params.vnp_TransactionStatus ?? '')
    ) {
      return IPN_RESPONSE.error;
    }

    const txnRef = params.vnp_TxnRef;
    if (!txnRef) return IPN_RESPONSE.notFound;

    try {
      return await this.payments.transaction(async (tx) => {
        const payment = await this.payments.findByTxnRef(txnRef, tx);
        if (!payment || payment.method !== 'VNPAY_QR') {
          return IPN_RESPONSE.notFound;
        }
        if (!this.hasExpectedAmount(params.vnp_Amount, payment.amount)) {
          return IPN_RESPONSE.invalidAmount;
        }
        if (payment.status !== 'PROCESSING') return IPN_RESPONSE.confirmed;

        const status = classifyFinalStatus(params, 'ipn');
        if (!status) return IPN_RESPONSE.error;
        return (await this.finalizeInTransaction(tx, payment, status, params))
          ? IPN_RESPONSE.success
          : IPN_RESPONSE.confirmed;
      });
    } catch {
      return IPN_RESPONSE.error;
    }
  }

  async reconcile(userId: string, orderId: string) {
    const order = await this.orders.findOwned(orderId, userId);
    if (!order) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng');

    const payment = await this.payments.findLatestForOwnedOrder(
      orderId,
      userId,
    );
    if (!payment || payment.method !== 'VNPAY_QR') {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y giao dá»‹ch VNPAY');
    }
    if (payment.status !== 'PROCESSING') return this.toResponse(payment);
    if (!payment.vnpTxnRef || !payment.paymentUrl) {
      throw new ServiceUnavailableException(
        'Giao dá»‹ch VNPAY thiáº¿u dá»¯ liá»‡u Ä‘á»ƒ Ä‘á»‘i soÃ¡t',
      );
    }

    const paymentUrl = this.paymentUrlForQuery(payment);
    const verification = await this.gateway.queryTransaction({
      txnRef: payment.vnpTxnRef,
      transactionDate: paymentUrl.transactionDate,
      orderInfo: paymentUrl.orderInfo,
    });
    if (!verification.valid) {
      throw new ServiceUnavailableException(
        'Chá»¯ kÃ½ pháº£n há»“i truy váº¥n VNPAY khÃ´ng há»£p lá»‡',
      );
    }

    const params = verification.params;
    if (params.vnp_ResponseCode !== '00') {
      // QueryDR can answer 91/94 while VNPAY is still synchronizing or
      // throttling repeated requests. A signed query error never finalizes an
      // Order; IPN or a later reconciliation remains authoritative.
      return this.toResponse(payment);
    }
    if (
      params.vnp_Command !== 'querydr' ||
      !this.gateway.isExpectedMerchant(params.vnp_TmnCode) ||
      params.vnp_TxnRef !== payment.vnpTxnRef ||
      !this.hasExpectedAmount(params.vnp_Amount, payment.amount) ||
      params.vnp_TransactionType !== '01' ||
      !/^[0-9]{2}$/.test(params.vnp_TransactionStatus ?? '')
    ) {
      throw new ServiceUnavailableException(
        'Pháº£n há»“i truy váº¥n VNPAY khÃ´ng khá»›p giao dá»‹ch',
      );
    }

    const status = classifyFinalStatus(params, 'querydr');
    if (!status) return this.toResponse(payment);

    await this.payments.transaction(async (tx) => {
      const current = await this.payments.findByTxnRef(
        payment.vnpTxnRef!,
        tx,
      );
      if (
        !current ||
        current.orderId !== orderId ||
        current.userId !== userId ||
        current.method !== 'VNPAY_QR' ||
        current.status !== 'PROCESSING'
      ) {
        return;
      }
      await this.finalizeInTransaction(tx, current, status, params);
    });

    const reconciled = await this.payments.findByTxnRef(payment.vnpTxnRef);
    if (!reconciled) {
      throw new ServiceUnavailableException(
        'KhÃ´ng thá»ƒ Ä‘á»c káº¿t quáº£ Ä‘á»‘i soÃ¡t VNPAY',
      );
    }
    return this.toResponse(reconciled);
  }

  async handleReturn(query: VnpayQuery): Promise<string> {
    const errorRedirect = () => this.gateway.frontendRedirect('/payment/error');
    try {
      const verification = this.gateway.verifyCallback(query);
      if (!verification.valid) return errorRedirect();
      const params = verification.params;
      if (!this.gateway.isExpectedMerchant(params.vnp_TmnCode)) {
        return errorRedirect();
      }
      const payment = params.vnp_TxnRef
        ? await this.payments.findByTxnRef(params.vnp_TxnRef)
        : null;
      if (
        !payment ||
        payment.method !== 'VNPAY_QR' ||
        !this.hasExpectedAmount(params.vnp_Amount, payment.amount)
      ) {
        return errorRedirect();
      }
      const stage =
        params.vnp_ResponseCode === '00' &&
        params.vnp_TransactionStatus === '00'
          ? 'verifying'
          : 'unknown';
      return this.gateway.frontendRedirect(
        `/payment/${encodeURIComponent(payment.orderId)}/${stage}`,
      );
    } catch {
      return errorRedirect();
    }
  }

  private hasExpectedAmount(value: string | undefined, amount: number) {
    return (
      typeof value === 'string' &&
      /^[0-9]{1,12}$/.test(value) &&
      Number(value) === amount * 100
    );
  }

  private paymentUrlForQuery(payment: Payment) {
    try {
      const url = new URL(payment.paymentUrl ?? '');
      const transactionDate = url.searchParams.get('vnp_CreateDate') ?? '';
      const orderInfo = url.searchParams.get('vnp_OrderInfo') ?? '';
      if (
        url.protocol !== 'https:' ||
        url.searchParams.get('vnp_TxnRef') !== payment.vnpTxnRef ||
        !/^\d{14}$/.test(transactionDate) ||
        !orderInfo ||
        orderInfo.length > 255
      ) {
        throw new Error();
      }
      return { transactionDate, orderInfo };
    } catch {
      throw new ServiceUnavailableException(
        'URL giao dá»‹ch VNPAY khÃ´ng thá»ƒ Ä‘á»‘i soÃ¡t',
      );
    }
  }

  private async finalizeInTransaction(
    tx: Prisma.TransactionClient,
    payment: Payment,
    status: PaymentFinalStatus,
    params: Readonly<Record<string, string>>,
  ): Promise<boolean> {
    const finalized = await this.payments.conditionalFinalize(tx, {
      id: payment.id,
      status,
      responseCode: params.vnp_ResponseCode,
      transactionStatus: params.vnp_TransactionStatus,
      transactionNo: params.vnp_TransactionNo,
      bankCode: params.vnp_BankCode,
      cardType: params.vnp_CardType,
      payDate: params.vnp_PayDate,
      processedAt: new Date(),
    });
    if (finalized.count !== 1) return false;

    await this.orders.applyPaymentResult(
      {
        orderId: payment.orderId,
        userId: payment.userId,
        method: payment.method,
        status,
      },
      tx,
    );
    return true;
  }

  private assertReplay(payment: Payment, input: CreatePaymentDto): Payment {
    if (payment.orderId !== input.orderId || payment.method !== input.method) {
      throw new ConflictException(
        'Idempotency key đã được dùng cho yêu cầu khác',
      );
    }
    return payment;
  }

  private toResponse(payment: Payment) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      status: payment.status,
      idempotencyKey: payment.idempotencyKey,
      ...(payment.paymentUrl ? { paymentUrl: payment.paymentUrl } : {}),
      ...(payment.expiresAt
        ? { expiresAt: payment.expiresAt.toISOString() }
        : {}),
    };
  }
}
