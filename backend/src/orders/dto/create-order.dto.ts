import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
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

export class CreateOrderItemDto {
  @IsUUID() productId: string;
  @IsEnum(ProductSizeCode) size: ProductSizeCode;
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  toppingIds: string[];
  @IsInt() @Min(1) @Max(99) quantity: number;
  @IsString() @MinLength(1) @MaxLength(40) ice: string;
  @IsString() @MinLength(1) @MaxLength(40) sugar: string;
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
