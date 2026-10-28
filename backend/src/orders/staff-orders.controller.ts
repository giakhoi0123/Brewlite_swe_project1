import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrdersService } from './orders.service';

export class StaffStatusDto {
  @IsIn(['PREPARING', 'READY', 'COMPLETED']) status: OrderStatus;
}

export class CancelOrderDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 300)
  reason: string;
}

@Controller('staff/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BARISTA)
export class StaffOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list() {
    return this.orders.staffList();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.staffGet(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelOrderDto) {
    return this.orders.staffCancel(id, dto.reason);
  }

  @Patch(':id/status')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffStatusDto,
  ) {
    return this.orders.staffTransition(id, dto.status);
  }
}
