import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductSizeCode } from '@prisma/client';
import { ICE_LEVELS, SUGAR_LEVELS } from '../../cart/cart-pricing';

export class CreateOrderItemDto {
  @Transform(({ value }) => typeof value === 'string' ? value.toLowerCase() : value)
  @IsUUID() productId: string;
  @IsEnum(ProductSizeCode) size: ProductSizeCode;
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  @Transform(({ value }) => Array.isArray(value)
    ? value.map((id: unknown) => typeof id === 'string' ? id.toLowerCase() : id)
    : value)
  toppingIds: string[];
  @IsInt() @Min(1) @Max(99) quantity: number;
  @IsIn(ICE_LEVELS) ice: string;
  @IsIn(SUGAR_LEVELS) sugar: string;
  @IsOptional() @IsString() @MaxLength(120) note?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  promotionCode?: string;
}
