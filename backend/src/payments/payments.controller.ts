import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
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
  ) {
    return this.payments.pay(
      request.user.userId,
      input,
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

  @Get('vnpay/ipn')
  ipn(@Query() query: VnpayQuery) {
    return this.payments.handleIpn(query);
  }

  @Get('vnpay/return')
  async returnFromVnpay(
    @Query() query: VnpayQuery,
    @Res() response: Response,
  ) {
    response.redirect(302, await this.payments.handleReturn(query));
  }
}
