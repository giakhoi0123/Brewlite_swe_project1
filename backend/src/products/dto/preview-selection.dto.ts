import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateOrderItemDto } from '../../orders/dto/create-order.dto';

export class PreviewSelectionDto {
  @ValidateNested()
  @Type(() => CreateOrderItemDto)
  candidate: CreateOrderItemDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  cartItems?: CreateOrderItemDto[];
}

