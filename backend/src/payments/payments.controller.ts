import { BadRequestException, Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  pay(
    @Req() request: Request & { user: { userId: string } },
    @Body() input: CreatePaymentDto,
    @Headers('idempotency-key') headerKey?: string,
  ) {
    if (headerKey && input.idempotencyKey && headerKey !== input.idempotencyKey)
      throw new BadRequestException('Idempotency-Key không khớp với body');
    const idempotencyKey = headerKey || input.idempotencyKey;
    if (!idempotencyKey || !isUUID(idempotencyKey))
      throw new BadRequestException('Idempotency-Key không hợp lệ');
    return this.payments.pay(request.user.userId, { ...input, idempotencyKey });
  }
}
