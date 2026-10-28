import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { IngredientUnit, Prisma, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsNumber, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma.service';

export class CreateIngredientDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 120) name: string;
  @IsEnum(IngredientUnit) unit: IngredientUnit;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(999999999.999) stock: number;
}
export class ReceiveIngredientDto {
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(999999999.999) amount: number;
}
export class RecipeLineDto extends ReceiveIngredientDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.toLowerCase() : value)
  @IsUUID() ingredientId: string;
}
export class RecipeDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ArrayUnique((line: RecipeLineDto) => line.ingredientId)
  @ValidateNested({ each: true }) @Type(() => RecipeLineDto)
  ingredients: RecipeLineDto[];
}

@Controller('staff/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BARISTA)
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
  }

  @Post()
  async create(@Body() dto: CreateIngredientDto) {
    try {
      return await this.prisma.ingredient.create({ data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Tên nguyên vật liệu đã tồn tại');
      throw error;
    }
  }

  @Post(':id/receipts')
  async receive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveIngredientDto) {
    return this.prisma.$transaction(async (tx) => {
      if (!await tx.ingredient.findUnique({ where: { id } })) throw new NotFoundException('Không tìm thấy nguyên liệu');
      const changed = await tx.ingredient.updateMany({
        where: { id, stock: { lte: new Prisma.Decimal('999999999.999').minus(dto.amount) } },
        data: { stock: { increment: dto.amount }, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException('Lượng tồn kho vượt giới hạn');
      return tx.ingredient.findUniqueOrThrow({ where: { id } });
    });
  }

  @Get('recipes')
  async recipes() {
    const [sizes, toppings] = await Promise.all([
      this.prisma.productSize.findMany({ include: { recipe: { include: { ingredient: true } } } }),
      this.prisma.topping.findMany({ include: { recipe: { include: { ingredient: true } } } }),
    ]);
    return { sizes, toppings };
  }

  @Put('product-sizes/:id/recipe')
  productRecipe(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecipeDto) {
    return this.replaceRecipe('product', id, dto);
  }

  @Put('toppings/:id/recipe')
  toppingRecipe(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecipeDto) {
    return this.replaceRecipe('topping', id, dto);
  }

  private async replaceRecipe(kind: 'product' | 'topping', id: string, dto: RecipeDto) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize whole-recipe replacements; concurrent PUTs cannot merge half of each recipe.
      const parent = kind === 'product'
        ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM product_sizes WHERE id = ${id}::uuid FOR UPDATE`
        : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM toppings WHERE id = ${id}::uuid FOR UPDATE`;
      if (!parent.length) throw new NotFoundException('Không tìm thấy size hoặc topping');
      const ids = dto.ingredients.map((line) => line.ingredientId);
      if (new Set(ids).size !== ids.length ||
          await tx.ingredient.count({ where: { id: { in: ids } } }) !== ids.length)
        throw new BadRequestException('Nguyên vật liệu trùng hoặc không tồn tại');
      if (kind === 'product') {
        await tx.productRecipe.deleteMany({ where: { productSizeId: id } });
        await tx.productRecipe.createMany({ data: dto.ingredients.map((line) => ({ ...line, productSizeId: id })) });
        return tx.productRecipe.findMany({ where: { productSizeId: id } });
      }
      await tx.toppingRecipe.deleteMany({ where: { toppingId: id } });
      await tx.toppingRecipe.createMany({ data: dto.ingredients.map((line) => ({ ...line, toppingId: id })) });
      return tx.toppingRecipe.findMany({ where: { toppingId: id } });
    });
  }
}
