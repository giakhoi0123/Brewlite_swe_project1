import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { CartLineDto, MergeCartDto, UpdateCartItemDto } from './dto/cart-line.dto';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@Req() request: AuthedRequest) {
    return this.cart.get(request.user.userId);
  }

  @Post('items')
  add(@Req() request: AuthedRequest, @Body() line: CartLineDto) {
    return this.cart.add(request.user.userId, line);
  }

  @Post('merge')
  @HttpCode(200)
  merge(@Req() request: AuthedRequest, @Body() input: MergeCartDto) {
    return this.cart.merge(request.user.userId, input);
  }

  @Patch('items/:id')
  update(
    @Req() request: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateCartItemDto,
  ) {
    return this.cart.update(request.user.userId, id, input);
  }

  @Delete('items/:id')
  remove(@Req() request: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cart.remove(request.user.userId, id);
  }

  @Delete()
  clear(@Req() request: AuthedRequest) {
    return this.cart.clear(request.user.userId);
  }
}
