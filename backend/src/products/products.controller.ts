import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ValidateCartDto } from './validate-cart.dto';
import { PreviewSelectionDto } from './dto/preview-selection.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll() {
    return this.products.findAll();
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.products.findOne(id);
  }

  @Post('availability')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  validateCart(@Body() dto: ValidateCartDto) {
    return this.products.validateCart(dto.items);
  }

  @Post('preview')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  previewSelection(@Body() dto: PreviewSelectionDto) {
    return this.products.previewSelection(dto);
  }
}
