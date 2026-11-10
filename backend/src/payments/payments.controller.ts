import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { isUUID } from 'class-validator';
import type { Request, Response } from 'express';
import { AdminJwtAuthGuard } from '../auth/admin-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  RequestAdminPaymentCancellationDto,
  ReviewAdminPaymentCancellationDto,
} from './dto/admin-payment-cancellation.dto';
import {
  AdminPaymentQueryDto,
  ReviewAdminPaymentDto,
} from './dto/review-admin-payment.dto';
import type { VnpayQuery } from './payment.types';
import { PaymentsService } from './payments.service';

export function normalizeVnpayIp(value: string | undefined): string {
  if (!value || value === '::1') return '127.0.0.1';
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  pay(
    @Req() request: Request & { user: { userId: string } },
    @Body() input: CreatePaymentDto,
    @Headers('idempotency-key') headerKey?: string,
  ) {
    if (
      headerKey &&
      input.idempotencyKey &&
      headerKey !== input.idempotencyKey
    ) {
      throw new BadRequestException('Idempotency-Key không khớp với body');
    }
    const idempotencyKey = headerKey || input.idempotencyKey;
    if (!idempotencyKey || !isUUID(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key không hợp lệ');
    }
    return this.payments.pay(
      request.user.userId,
      { ...input, idempotencyKey },
      normalizeVnpayIp(request.ip || request.socket.remoteAddress),
    );
  }

  @Post(':orderId/reconcile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  reconcile(
    @Req() request: Request & { user: { userId: string } },
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ) {
    return this.payments.reconcile(request.user.userId, orderId);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  current(
    @Req() request: Request & { user: { userId: string } },
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ) {
    return this.payments.current(request.user.userId, orderId);
  }

  @Post(':orderId/cancel-request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  requestCancellation(
    @Req() request: Request & { user: { userId: string } },
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() input: RequestAdminPaymentCancellationDto,
  ) {
    return this.payments.requestAdminCancellation(
      request.user.userId,
      orderId,
      input,
    );
  }

  @Get('vnpay/ipn')
  ipn(@Query() query: VnpayQuery) {
    return this.payments.handleIpn(query);
  }

  @Get('vnpay/return')
  async returnFromVnpay(@Query() query: VnpayQuery, @Res() response: Response) {
    response.redirect(302, await this.payments.handleReturn(query));
  }
}

@Controller('admin/payments')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() query: AdminPaymentQueryDto) {
    return this.payments.listAdminApprovals(query.status);
  }

  @Patch(':paymentId/review')
  review(
    @Req() request: Request & { user: { userId: string } },
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() input: ReviewAdminPaymentDto,
  ) {
    return this.payments.reviewAdminApproval(
      request.user.userId,
      paymentId,
      input,
    );
  }

  @Patch(':paymentId/cancel-review')
  reviewCancellation(
    @Req() request: Request & { user: { userId: string } },
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() input: ReviewAdminPaymentCancellationDto,
  ) {
    return this.payments.reviewAdminCancellation(
      request.user.userId,
      paymentId,
      input,
    );
  }
}
