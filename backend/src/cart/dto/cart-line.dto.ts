import { ProductSizeCode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  ValidateNested,
} from 'class-validator';
import { ICE_LEVELS, MAX_LINE_QUANTITY, NOTE_MAX_LENGTH, SUGAR_LEVELS } from '../cart-pricing';

export class CartLineDto {
  @IsUUID('all')
  productId!: string;

  @IsEnum(ProductSizeCode)
  size!: ProductSizeCode;

  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  toppingIds!: string[];

  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;

  @IsIn(ICE_LEVELS)
  ice!: string;

  @IsIn(SUGAR_LEVELS)
  sugar!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  note?: string;
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity?: number;

  @IsOptional()
  @IsEnum(ProductSizeCode)
  size?: ProductSizeCode;
}

export class MergeCartDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  items!: CartLineDto[];
}
