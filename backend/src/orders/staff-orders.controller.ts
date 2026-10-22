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
import { IsIn, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrdersService } from './orders.service';

export class StaffStatusDto {
  @IsIn(['PREPARING', 'READY', 'COMPLETED', 'CANCELLED']) status: OrderStatus;
}

export class StaffCancelDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
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

  @Patch(':id/status')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffStatusDto,
  ) {
    return this.orders.staffTransition(id, dto.status);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffCancelDto,
  ) {
    return this.orders.staffCancel(id, dto.reason);
  }
}
