import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateOrderDto,
  ) {
    return this.orders.create(req.user.userId, dto);
  }

  @Get('me')
  mine(@Req() req: { user: { userId: string } }) {
    return this.orders.mine(req.user.userId);
  }

  @Get(':id/status')
  async status(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return { status: (await this.orders.get(id, req.user.userId)).status };
  }

  @Get(':id')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.orders.get(id, req.user.userId);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
    @Body() body?: { reason?: string },
  ) {
    return this.orders.customerCancel(id, req.user.userId, body?.reason);
  }
}
