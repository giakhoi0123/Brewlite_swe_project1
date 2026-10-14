import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('barista')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BARISTA)
export class BaristaController {
  @Get('dashboard')
  dashboard() {
    return { message: 'Khu vực nhân viên pha chế', orders: [] };
  }
}
