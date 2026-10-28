# TÀI LIỆU ÔN TẬP VÀ GIẢI THÍCH TOÀN BỘ CODE TV4 (ORDERS, INVENTORY & BARISTA)
> **Cách dùng:** Bạn hãy kéo thả nguyên file này (`TV4_CODE_GIAI_THICH.md`) lên Gemini, sau đó copy câu lệnh dưới đây dán vào để Gemini dạy bạn:
>
> *"Chào Gemini, đây là toàn bộ code backend phần Quản lý Đơn hàng (Orders), Tồn kho & Định mức Nguyên vật liệu (Inventory & Ingredients) và Quầy Barista mà mình phụ trách trong bài tập lớn Công nghệ phần mềm. Hãy đóng vai một gia sư lập trình siêu dễ hiểu: giải thích cho mình từng file, từng hàm cốt lõi làm nhiệm vụ gì, luồng chạy thực tế ra sao (đặc biệt cách tính nguyên vật liệu ra 1 ly và cộng topping trừ kho), và đặt các câu hỏi vấn đáp mô phỏng thầy cô hỏi thi để kiểm tra mình nhé!"*

---

## MỤC LỤC CÁC PHẦN TRONG TÀI LIỆU NÀY
1. `backend/prisma/schema.prisma` (Mô hình dữ liệu: Đơn hàng, Món, Topping, Nguyên vật liệu & Công thức)
2. `backend/src/orders/order-state-machine.ts` (Máy trạng thái - Luật di chuyển trạng thái đơn hàng)
3. `backend/src/inventory/inventory.service.ts` & `recipe-capacity.ts` (Nghiệp vụ tính nguyên vật liệu 1 ly + topping, trừ/hoàn kho & kiểm tra công suất pha)
4. `backend/src/orders/orders.service.ts` (Nghiệp vụ tạo đơn, giữ kho nguyên tử, snapshot nguyên liệu, chuyển trạng thái, hủy đơn)
5. `backend/src/orders/orders.controller.ts` (API dành cho Khách hàng: tạo đơn, xem đơn, xem trạng thái)
6. `backend/src/orders/staff-orders.controller.ts` (API dành cho Barista: xem danh sách đơn, xem chi tiết, đổi trạng thái, hủy đơn kèm lý do)
7. `backend/src/inventory/inventory.controller.ts` (API dành cho Barista: quản lý nguyên vật liệu, nhập kho, sửa công thức ly/size và topping)
8. `backend/src/orders/order-response.ts` (Hàm lọc dữ liệu trả về client - bảo mật thông tin)
9. **GIẢI THÍCH CHUYÊN SÂU CÂU HỎI THI CỐT LÕI**: *"1 ly tính ra bao nhiêu nguyên vật liệu, cộng topping tính thế nào, và trừ kho ra sao?"*

---

## 1. FILE: backend/prisma/schema.prisma (Mô hình dữ liệu của TV4)

```prisma
enum OrderStatus {
  PENDING
  PAID
  PREPARING
  READY
  COMPLETED
  PAYMENT_FAILED
  CANCELLED
}

// 1. ĐƠN HÀNG
model Order {
  id                  String                 @id @default(uuid()) @db.Uuid
  userId              String                 @map("user_id") @db.Uuid
  status              OrderStatus            @default(PENDING)
  version             Int                    @default(1) // Khóa lạc quan (Optimistic Locking) chống race condition
  subtotal            Int
  discountAmount      Int                    @default(0) @map("discount_amount")
  total               Int
  promotionCode       String?                @map("promotion_code")
  inventoryHeld       Boolean                @default(true) @map("inventory_held") // Đang giữ kho hay đã nhả kho
  ingredientInventory Boolean                @default(false) @map("ingredient_inventory") // Đơn có áp dụng kho nguyên liệu không
  ingredientUsage     OrderIngredientUsage[] // Snapshot lượng nguyên liệu đã trừ cho đơn này
  cancelReason        String?                @map("cancel_reason") @db.VarChar(300) // Lý do hủy của Barista
  completedAt         DateTime?              @map("completed_at") // Thời điểm Barista bấm giao đơn COMPLETED
  createdAt           DateTime               @default(now()) @map("created_at")
  updatedAt           DateTime               @updatedAt @map("updated_at")
  user                User                   @relation(fields: [userId], references: [id], onDelete: Restrict)
  items               OrderItem[]
  statusHistory       OrderStatusHistory[]

  @@index([userId, createdAt])
  @@index([status, createdAt])
  @@map("orders")
}

// 2. CHI TIẾT TỪNG DÒNG MÓN TRONG ĐƠN
model OrderItem {
  id        String             @id @default(uuid()) @db.Uuid
  orderId   String             @map("order_id") @db.Uuid
  productId String             @map("product_id") @db.Uuid
  position  Int
  name      String             // Snapshot: Lưu tên món tại thời điểm đặt
  imageUrl  String             @map("image_url")
  size      ProductSizeCode
  basePrice Int                @map("base_price") // Giá gốc món
  sizePrice Int                @map("size_price") // Phụ thu size
  unitPrice Int                @map("unit_price") // Đơn giá 1 ly = base + size + topping
  qty       Int
  lineTotal Int                @map("line_total") // Thành tiền = unitPrice * qty
  ice       String
  sugar     String
  note      String?            // Ghi chú cho Barista
  order     Order              @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product            @relation(fields: [productId], references: [id], onDelete: Restrict)
  toppings  OrderItemTopping[]

  @@unique([orderId, position])
  @@index([productId])
  @@map("order_items")
}

// 3. TOPPING ĐÃ CHỌN TRÊN TỪNG DÒNG MÓN
model OrderItemTopping {
  orderItemId String    @map("order_item_id") @db.Uuid
  toppingId   String    @map("topping_id") @db.Uuid
  name        String    // Snapshot tên topping
  extraPrice  Int       @map("extra_price") // Snapshot giá topping
  orderItem   OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  topping     Topping   @relation(fields: [toppingId], references: [id], onDelete: Restrict)

  @@id([orderItemId, toppingId])
  @@index([toppingId])
  @@map("order_item_toppings")
}

// 4. LỊCH SỬ CHUYỂN TRẠNG THÁI ĐƠN HÀNG
model OrderStatusHistory {
  id         String       @id @default(uuid()) @db.Uuid
  orderId    String       @map("order_id") @db.Uuid
  fromStatus OrderStatus? @map("from_status")
  toStatus   OrderStatus  @map("to_status")
  version    Int
  createdAt  DateTime     @default(now()) @map("created_at")
  order      Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@unique([orderId, version])
  @@map("order_status_history")
}

// 5. ĐƠN VỊ TÍNH NGUYÊN LIỆU (GAM, MILILIT, CÁI)
enum IngredientUnit {
  G
  ML
  PIECE
}

// 6. THỰC THỂ NGUYÊN VẬT LIỆU TRONG KHO
model Ingredient {
  id       String                 @id @default(uuid()) @db.Uuid
  name     String                 @unique // Tên nguyên liệu: Cà phê, Sữa tươi, Sữa đặc...
  unit     IngredientUnit         // Đơn vị đo lường: G, ML, PIECE
  stock    Decimal                @default(0) @db.Decimal(12, 3) // Tồn kho thực tế (độ chính xác 3 chữ số thập phân)
  version  Int                    @default(1) // Khóa lạc quan chống tranh chấp kho
  products ProductRecipe[]
  toppings ToppingRecipe[]
  orders   OrderIngredientUsage[]

  @@map("ingredients")
}

// 7. ĐỊNH MỨC NGUYÊN LIỆU CHO 1 LY THEO SIZE (ProductRecipe)
// Ví dụ: Bạc xỉu size M cần 20g cà phê + 30ml sữa tươi + 25ml sữa đặc
model ProductRecipe {
  productSizeId String      @map("product_size_id") @db.Uuid
  ingredientId  String      @map("ingredient_id") @db.Uuid
  amount        Decimal     @db.Decimal(12, 3) // Lượng cần cho 1 ly
  productSize   ProductSize @relation(fields: [productSizeId], references: [id], onDelete: Cascade)
  ingredient    Ingredient  @relation(fields: [ingredientId], references: [id], onDelete: Restrict)

  @@id([productSizeId, ingredientId])
  @@index([ingredientId])
  @@map("product_recipes")
}

// 8. ĐỊNH MỨC NGUYÊN LIỆU CHO 1 PHẦN TOPPING (ToppingRecipe)
// Ví dụ: 1 phần Kem Cheese cần 20g bột cheese + 15ml sữa tươi; 1 shot Espresso cần 10g cà phê
model ToppingRecipe {
  toppingId    String     @map("topping_id") @db.Uuid
  ingredientId String     @map("ingredient_id") @db.Uuid
  amount       Decimal    @db.Decimal(12, 3) // Lượng cần cho 1 phần topping
  topping      Topping    @relation(fields: [toppingId], references: [id], onDelete: Cascade)
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Restrict)

  @@id([toppingId, ingredientId])
  @@index([ingredientId])
  @@map("topping_recipes")
}

// 9. BẢN CHỤP NGUYÊN LIỆU TIÊU HAO THEO ĐƠN (OrderIngredientUsage - Immutable Snapshot)
// Lưu chính xác số lượng nguyên liệu đã trừ của đơn để khi hủy hoặc retry không phụ thuộc công thức đã đổi
model OrderIngredientUsage {
  orderId      String     @map("order_id") @db.Uuid
  ingredientId String     @map("ingredient_id") @db.Uuid
  amount       Decimal    @db.Decimal(12, 3) // Tổng lượng đã trừ của nguyên liệu này trong đơn
  order        Order      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Restrict)

  @@id([orderId, ingredientId])
  @@index([ingredientId])
  @@map("order_ingredient_usage")
}
```

---

## 2. FILE: backend/src/orders/order-state-machine.ts

```typescript
import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

// Ma trận chuyển trạng thái hợp lệ
const validTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [], // Trạng thái kết thúc (Terminal) - Không thể đổi nữa
  PAYMENT_FAILED: ['PENDING', 'CANCELLED'], // Có thể thử thanh toán lại (retry -> PENDING) hoặc hủy
  CANCELLED: [], // Trạng thái kết thúc (Terminal) - Không thể đổi nữa
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) {
    throw new ConflictException(`Đơn hàng đã ở trạng thái ${from}`);
  }
  if (!canTransitionOrder(from, to)) {
    throw new ConflictException(`Không thể chuyển trạng thái từ ${from} sang ${to}`);
  }
}
```

---

## 3. FILE: backend/src/inventory/inventory.service.ts & recipe-capacity.ts

### A. backend/src/inventory/inventory.service.ts

```typescript
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type StockItem = { productId: string; qty: number };
export type StockSnapshot = { id: string; stock: number; version: number };
export type IngredientAmount = { ingredientId: string; amount: Prisma.Decimal };
export type RecipeProduct = {
  id: string;
  sizes: { code: string; recipe: IngredientAmount[] }[];
  toppings: { toppingId: string; topping: { recipe: IngredientAmount[] } }[];
};

function quantities(items: StockItem[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.qty) || item.qty <= 0) {
      throw new BadRequestException('Số lượng không hợp lệ');
    }
    const total = (totals.get(item.productId) ?? 0) + item.qty;
    totals.set(item.productId, total);
  }
  // Khóa theo thứ tự alphabet để tránh Deadlock giữa nhiều đơn đồng thời
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
}

@Injectable()
export class InventoryService {
  /**
   * CÔNG THỨC TÍNH NGUYÊN LIỆU:
   * Với mỗi dòng món:
   * Lượng nguyên liệu = Số lượng ly * (Định mức size ly + Tổng định mức các topping đã chọn)
   * Các món khác nhau trong cùng giỏ hàng nếu dùng chung nguyên liệu (vd: sữa tươi) sẽ được cộng gộp lại.
   */
  demand(
    items: { productId: string; size: string; quantity: number; toppingIds: string[] }[],
    products: RecipeProduct[],
  ): IngredientAmount[] {
    const totals = new Map<string, Prisma.Decimal>();

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        throw new BadRequestException('Số lượng không hợp lệ');
      }

      const product = products.find((p) => p.id === item.productId);
      const base = product?.sizes.find((s) => s.code === item.size)?.recipe;

      // Gom công thức của size ly + công thức của tất cả topping được chọn
      const recipes = [
        base,
        ...item.toppingIds.map((id) => product?.toppings.find((t) => t.toppingId === id)?.topping.recipe),
      ];

      for (const recipe of recipes) {
        if (!recipe?.length) {
          throw new ConflictException('Món hoặc topping chưa có định mức nguyên vật liệu');
        }

        for (const row of recipe) {
          if (!row.amount.isFinite() || row.amount.lte(0)) {
            throw new ConflictException('Định mức nguyên vật liệu không hợp lệ');
          }

          // Nhân số lượng ly với định mức của nguyên liệu này
          const total = (totals.get(row.ingredientId) ?? new Prisma.Decimal(0)).plus(
            row.amount.mul(item.quantity),
          );

          totals.set(row.ingredientId, total);
        }
      }
    }

    return [...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ingredientId, amount]) => ({ ingredientId, amount }));
  }

  /**
   * GIỮ CHỖ NGUYÊN LIỆU TRONG KHO (RESERVE):
   * Kiểm tra tồn kho có đủ không, nếu đủ thì trừ tồn và tăng version (Optimistic Locking)
   */
  async reserveIngredients(tx: Prisma.TransactionClient, usage: IngredientAmount[]) {
    if (!usage.length) throw new ConflictException('Đơn chưa có định mức nguyên vật liệu');

    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: usage.map((row) => row.ingredientId) } },
    });

    for (const row of [...usage].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))) {
      const ingredient = ingredients.find((i) => i.id === row.ingredientId);
      if (!ingredient || ingredient.stock.lt(row.amount)) {
        throw new ConflictException(`Không đủ nguyên vật liệu: ${ingredient?.name ?? row.ingredientId}`);
      }

      const changed = await tx.ingredient.updateMany({
        where: { id: row.ingredientId, version: ingredient.version, stock: { gte: row.amount } },
        data: { stock: { decrement: row.amount }, version: { increment: 1 } },
      });

      if (changed.count !== 1) {
        throw new ConflictException('Kho nguyên liệu vừa thay đổi. Vui lòng thử lại');
      }
    }
  }

  /**
   * HOÀN TRẢ NGUYÊN LIỆU VÀO KHO (RESTORE):
   * Gọi khi đơn bị hủy hoặc thanh toán thất bại
   */
  async restoreIngredients(tx: Prisma.TransactionClient, usage: IngredientAmount[]) {
    if (!usage.length) throw new ConflictException('Đơn thiếu snapshot nguyên vật liệu');

    for (const row of [...usage].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))) {
      const changed = await tx.ingredient.updateMany({
        where: { id: row.ingredientId, stock: { lte: new Prisma.Decimal('999999999.999').minus(row.amount) } },
        data: { stock: { increment: row.amount }, version: { increment: 1 } },
      });

      if (changed.count !== 1) throw new ConflictException('Không thể hoàn kho nguyên vật liệu');
    }
  }

  // Giữ tồn kho theo số lượng sản phẩm cũ (tương thích ngược)
  async reserve(tx: Prisma.TransactionClient, items: StockItem[], snapshots?: StockSnapshot[]) {
    const totals = quantities(items);
    const products = snapshots ?? (await tx.product.findMany({
      where: { id: { in: totals.map(([id]) => id) } },
      select: { id: true, stock: true, version: true },
    }));

    for (const [id, qty] of totals) {
      const product = products.find((p) => p.id === id);
      if (!product || product.stock < qty) throw new ConflictException(`Sản phẩm ${id} không đủ tồn kho`);
      const result = await tx.product.updateMany({
        where: { id, version: product.version, stock: { gte: qty } },
        data: { stock: { decrement: qty }, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Tồn kho vừa thay đổi. Vui lòng kiểm tra giỏ');
    }
  }

  async restore(tx: Prisma.TransactionClient, items: StockItem[]) {
    for (const [id, qty] of quantities(items)) {
      await tx.product.update({
        where: { id },
        data: { stock: { increment: qty }, version: { increment: 1 } },
      });
    }
  }
}
```

### B. backend/src/inventory/recipe-capacity.ts

```typescript
import { Prisma } from '@prisma/client';

/**
 * Tính số ly tối đa có thể pha dựa trên lượng nguyên liệu hạn chế nhất trong kho (Bottleneck)
 * Ví dụ: Cần 20g cafe và 30ml sữa. Kho còn 100g cafe (đủ 5 ly) và 60ml sữa (đủ 2 ly) -> Công suất = 2 ly.
 */
export function recipeCapacity(recipe: { amount: Prisma.Decimal; ingredient: { stock: Prisma.Decimal } }[]): number {
  if (!recipe.length) return 0;
  return Math.min(
    2147483647,
    ...recipe.map((line) =>
      line.amount.gt(0) ? line.ingredient.stock.div(line.amount).floor().toNumber() : 0,
    ),
  );
}
```

---

## 4. FILE: backend/src/orders/orders.service.ts

```typescript
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ORDER_DISCOUNT, OrderDiscount } from './order-discount.interface';
import { orderInclude, orderResponse } from './order-response';
import { assertOrderTransition } from './order-state-machine';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(ORDER_DISCOUNT) private readonly discount: OrderDiscount,
  ) {}

  private transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { timeout: 10000 });
  }

  // 1. TẠO ĐƠN HÀNG VÀ TRỪ KHO NGUYÊN LIỆU TRONG TRANSACTION
  async create(userId: string, dto: CreateOrderDto) {
    return this.transaction(async (tx) => {
      // Nạp thông tin sản phẩm kèm công thức size và topping
      const products = await tx.product.findMany({
        where: { id: { in: [...new Set(dto.items.map((i) => i.productId))] } },
        include: {
          sizes: { include: { recipe: true } },
          toppings: { include: { topping: { include: { recipe: true } } } },
        },
      });

      const catalog = new Map(products.map((p) => [p.id, p]));
      let subtotal = 0;
      const items: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];

      for (let pos = 0; pos < dto.items.length; pos++) {
        const line = dto.items[pos];
        const product = catalog.get(line.productId);
        if (!product) throw new BadRequestException(`Sản phẩm ${line.productId} không tồn tại`);

        const size = product.sizes.find((s) => s.code === line.size && s.available);
        if (!size) throw new BadRequestException(`Size ${line.size} không hợp lệ`);

        const toppingMap = new Map(
          product.toppings.filter((t) => t.available).map((t) => [t.toppingId, t]),
        );
        let toppingsExtra = 0;
        const lineToppings: Prisma.OrderItemToppingUncheckedCreateWithoutOrderItemInput[] = [];
        for (const tid of line.toppingIds) {
          const t = toppingMap.get(tid);
          if (!t) throw new BadRequestException(`Topping ${tid} không hợp lệ`);
          toppingsExtra += t.extraPrice;
          lineToppings.push({ toppingId: tid, name: t.topping.name, extraPrice: t.extraPrice });
        }

        const basePrice = product.price;
        const sizePrice = size.extraPrice;
        const unitPrice = basePrice + sizePrice + toppingsExtra;
        const lineTotal = unitPrice * line.quantity;
        subtotal += lineTotal;

        items.push({
          position: pos,
          productId: line.productId,
          name: product.name,
          imageUrl: product.imageUrl,
          size: line.size,
          basePrice,
          sizePrice,
          unitPrice,
          qty: line.quantity,
          lineTotal,
          ice: line.ice,
          sugar: line.sugar,
          note: line.note?.trim() || null,
          toppings: { create: lineToppings },
        });
      }

      // TÍNH TOÁN VÀ GIỮ KHO NGUYÊN LIỆU (Size + Toppings)
      const ingredientUsage = this.inventory.demand(dto.items, products);
      await this.inventory.reserve(tx, items, products); // Giữ Product stock cũ
      await this.inventory.reserveIngredients(tx, ingredientUsage); // Trừ kho nguyên liệu

      // Tính giảm giá & tổng tiền
      const discountAmount = await this.discount.calculate(tx, {
        userId,
        subtotal,
        promotionCode: dto.promotionCode,
      });
      const total = subtotal - discountAmount;

      // Lưu đơn hàng và Snapshot nguyên liệu đã sử dụng
      const created = await tx.order.create({
        data: {
          userId,
          subtotal,
          discountAmount,
          total,
          promotionCode: dto.promotionCode,
          status: OrderStatus.PENDING,
          inventoryHeld: true,
          ingredientInventory: true,
          ingredientUsage: { create: ingredientUsage }, // Lưu snapshot không đổi
          items: { create: items },
          statusHistory: {
            create: { toStatus: OrderStatus.PENDING, version: 1 },
          },
        } satisfies Prisma.OrderUncheckedCreateInput,
        include: orderInclude,
      });

      return orderResponse(created);
    });
  }

  // 2. KHÁCH XEM DANH SÁCH ĐƠN CỦA MÌNH
  async listForCustomer(userId: string) {
    return (
      await this.prisma.order.findMany({
        where: { userId },
        include: orderInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map(orderResponse);
  }

  // 3. BARISTA XEM DANH SÁCH TẤT CẢ ĐƠN
  async staffList() {
    return (
      await this.prisma.order.findMany({
        where: {
          status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] },
        },
        include: orderInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    ).map(orderResponse);
  }

  // 4. BARISTA XEM CHI TIẾT 1 ĐƠN HÀNG
  async staffGet(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return orderResponse(order);
  }

  // 5. BARISTA HỦY ĐƠN HÀNG KÈM LÝ DO
  async staffCancel(id: string, reason: string) {
    return this.transaction(async (tx) =>
      orderResponse(await this.transitionInTransaction(tx, id, OrderStatus.CANCELLED, reason)),
    );
  }

  // 6. BARISTA CHUYỂN BƯỚC PHA CHẾ (PREPARING, READY, COMPLETED)
  async staffTransition(id: string, to: OrderStatus) {
    if (!(['PREPARING', 'READY', 'COMPLETED'] as OrderStatus[]).includes(to)) {
      throw new BadRequestException('Chỉ cho phép PREPARING, READY hoặc COMPLETED; hủy đơn phải dùng API cancel kèm lý do');
    }
    return this.transaction(async (tx) =>
      orderResponse(await this.transitionInTransaction(tx, id, to)),
    );
  }

  // 7. CHUYỂN TRẠNG THÁI VÀ XỬ LÝ HOÀN KHO / GIỮ LẠI NGUYÊN LIỆU
  async transitionInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    to: OrderStatus,
    reason?: string,
  ) {
    const cancelReason = typeof reason === 'string' ? reason.trim() : '';
    if (to === OrderStatus.CANCELLED && (!cancelReason || Array.from(cancelReason).length > 300)) {
      throw new BadRequestException('Lý do hủy phải có từ 1 đến 300 ký tự');
    }

    const order = await tx.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    assertOrderTransition(order.status, to);

    const release = to === OrderStatus.CANCELLED || to === OrderStatus.PAYMENT_FAILED;
    const reserve = order.status === OrderStatus.PAYMENT_FAILED && to === OrderStatus.PENDING;
    const transitionedAt = new Date();

    const changed = await tx.order.updateMany({
      where: { id, status: order.status, version: order.version },
      data: {
        status: to,
        version: { increment: 1 },
        inventoryHeld: release ? false : reserve ? true : order.inventoryHeld,
        ...(to === OrderStatus.CANCELLED ? { cancelReason } : {}),
        ...(to === OrderStatus.COMPLETED ? { completedAt: transitionedAt } : {}),
      },
    });
    if (changed.count !== 1) {
      throw new ConflictException('Đơn hàng vừa thay đổi. Vui lòng tải lại');
    }

    // NGUYÊN TẮC HOÀN KHO NGUYÊN LIỆU:
    // Nếu đơn bị hủy khi đang pha chế (PREPARING), nguyên liệu xem như ĐÃ DÙNG NÊN KHÔNG HOÀN LẠI VÀO KHO!
    if (release && order.inventoryHeld) {
      await this.inventory.restore(tx, order.items);
      if (order.ingredientInventory && order.status !== OrderStatus.PREPARING) {
        await this.inventory.restoreIngredients(tx, order.ingredientUsage);
      }
    }

    // Nếu thanh toán lại (retry -> PENDING): Giữ lại nguyên liệu đúng theo snapshot ban đầu
    if (reserve) {
      await this.inventory.reserve(tx, order.items);
      if (order.ingredientInventory) {
        await this.inventory.reserveIngredients(tx, order.ingredientUsage);
      }
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: to,
        version: order.version + 1,
        createdAt: transitionedAt,
      },
    });

    return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  }
}
```

---

## 5. FILE: backend/src/orders/orders.controller.ts

```typescript
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.userId, dto);
  }

  @Get('me')
  @Roles(Role.CUSTOMER)
  mine(@Req() req: { user: { userId: string } }) {
    return this.orders.listForCustomer(req.user.userId);
  }

  @Get(':id')
  @Roles(Role.CUSTOMER)
  get(@Req() req: { user: { userId: string } }, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getForCustomer(req.user.userId, id);
  }

  @Get(':id/status')
  @Roles(Role.CUSTOMER)
  async status(@Req() req: { user: { userId: string } }, @Param('id', ParseUUIDPipe) id: string) {
    return { status: await this.orders.getStatusForCustomer(req.user.userId, id) };
  }
}
```

---

## 6. FILE: backend/src/orders/staff-orders.controller.ts

```typescript
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrdersService } from './orders.service';

export class StaffStatusDto {
  @IsIn(['PREPARING', 'READY', 'COMPLETED']) status: OrderStatus;
}

export class CancelOrderDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 300)
  reason: string;
}

@Controller('staff/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BARISTA) // Chỉ nhân viên BARISTA mới có quyền
export class StaffOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list() {
    return this.orders.staffList();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.staffGet(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelOrderDto) {
    return this.orders.staffCancel(id, dto.reason);
  }

  @Patch(':id/status')
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StaffStatusDto) {
    return this.orders.staffTransition(id, dto.status);
  }
}
```

---

## 7. FILE: backend/src/inventory/inventory.controller.ts (API Quản lý kho cho Barista)

```typescript
import {
  BadRequestException, Body, ConflictException, Controller,
  Get, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards,
} from '@nestjs/common';
import { IngredientUnit, Prisma, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum,
  IsNumber, IsString, IsUUID, Length, Max, Min, ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma.service';

export class CreateIngredientDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(1, 120) name: string;
  @IsEnum(IngredientUnit) unit: IngredientUnit;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(999999999.999) stock: number;
}

export class ReceiveIngredientDto {
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(999999999.999) amount: number;
}

export class RecipeLineDto extends ReceiveIngredientDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() : value))
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

  // 1. Xem danh sách tất cả nguyên liệu trong kho
  @Get()
  list() {
    return this.prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
  }

  // 2. Thêm nguyên liệu mới vào kho
  @Post()
  async create(@Body() dto: CreateIngredientDto) {
    try {
      return await this.prisma.ingredient.create({ data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Tên nguyên vật liệu đã tồn tại');
      }
      throw error;
    }
  }

  // 3. Nhập thêm hàng vào kho (Cộng thêm tồn kho)
  @Post(':id/receipts')
  async receive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveIngredientDto) {
    return this.prisma.$transaction(async (tx) => {
      if (!await tx.ingredient.findUnique({ where: { id } })) {
        throw new NotFoundException('Không tìm thấy nguyên liệu');
      }
      const changed = await tx.ingredient.updateMany({
        where: { id, stock: { lte: new Prisma.Decimal('999999999.999').minus(dto.amount) } },
        data: { stock: { increment: dto.amount }, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException('Lượng tồn kho vượt giới hạn');
      return tx.ingredient.findUniqueOrThrow({ where: { id } });
    });
  }

  // 4. Xem công thức của các size món và topping
  @Get('recipes')
  async recipes() {
    const [sizes, toppings] = await Promise.all([
      this.prisma.productSize.findMany({ include: { recipe: { include: { ingredient: true } } } }),
      this.prisma.topping.findMany({ include: { recipe: { include: { ingredient: true } } } }),
    ]);
    return { sizes, toppings };
  }

  // 5. Cập nhật công thức cho một size của sản phẩm
  @Put('product-sizes/:id/recipe')
  productRecipe(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecipeDto) {
    return this.replaceRecipe('product', id, dto);
  }

  // 6. Cập nhật công thức cho một topping
  @Put('toppings/:id/recipe')
  toppingRecipe(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecipeDto) {
    return this.replaceRecipe('topping', id, dto);
  }

  private async replaceRecipe(kind: 'product' | 'topping', id: string, dto: RecipeDto) {
    return this.prisma.$transaction(async (tx) => {
      // Khóa dòng bằng FOR UPDATE để tránh race condition khi 2 nhân viên cùng sửa công thức
      const parent = kind === 'product'
        ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM product_sizes WHERE id = ${id}::uuid FOR UPDATE`
        : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM toppings WHERE id = ${id}::uuid FOR UPDATE`;
      if (!parent.length) throw new NotFoundException('Không tìm thấy size hoặc topping');

      const ids = dto.ingredients.map((line) => line.ingredientId);
      if (new Set(ids).size !== ids.length ||
          await tx.ingredient.count({ where: { id: { in: ids } } }) !== ids.length) {
        throw new BadRequestException('Nguyên vật liệu trùng hoặc không tồn tại');
      }

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
```

---

## 8. FILE: backend/src/orders/order-response.ts

```typescript
import { Prisma } from '@prisma/client';

export const orderInclude = {
  ingredientUsage: true, // Bao gồm cả thông tin nguyên liệu đã snapshot
  user: { select: { fullName: true } },
  items: {
    orderBy: { position: 'asc' },
    include: {
      toppings: {
        select: { toppingId: true, name: true, extraPrice: true },
      },
    },
  },
} as const;

export type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// Hàm lọc và định dạng dữ liệu trả về cho client:
// Không làm lộ mật khẩu, email riêng hay sessionVersion của User
export function orderResponse(order: OrderRecord) {
  return {
    id: order.id,
    userId: order.userId,
    customerName: order.user.fullName,
    status: order.status,
    subtotal: order.subtotal,
    discount: order.discountAmount,
    total: order.total,
    ...(order.promotionCode ? { promotionCode: order.promotionCode } : {}),
    createdAt: order.createdAt.toISOString(),
    ...(order.cancelReason ? { cancelReason: order.cancelReason } : {}),
    ...(order.completedAt ? { completedAt: order.completedAt.toISOString() } : {}),
    items: order.items.map((item) => ({
      key: item.id,
      productId: item.productId,
      name: item.name,
      imageUrl: item.imageUrl,
      size: item.size,
      toppingIds: item.toppings.map((t) => t.toppingId),
      toppingNames: item.toppings.map((t) => t.name),
      unitPrice: item.unitPrice,
      quantity: item.qty,
      lineTotal: item.lineTotal,
      ice: item.ice,
      sugar: item.sugar,
      ...(item.note ? { note: item.note } : {}),
    })),
  };
}
```

---

## 9. GIẢI THÍCH CHUYÊN SÂU CÂU HỎI THI CỐT LÕI
### *"Bao nhiêu nguyên vật liệu là tính ra một ly? Kể cả cộng topping cũng phải tính ra nguyên vật liệu, mỗi lần cộng là tính để trừ trong kho như thế nào?"*

Khi thầy cô hỏi câu này trong buổi bảo vệ đồ án, đây là câu trả lời chuẩn chỉnh nhất:

### 1. Cách tính nguyên vật liệu ra 1 ly đồ uống:
- Trong database, bảng `product_recipes` lưu định mức nguyên vật liệu cho từng `product_size_id` (ví dụ: size S, M, L).
- Ví dụ món **Bạc xỉu size M**:
  - Cà phê rang xay: **20 g**
  - Sữa tươi: **30 ml**
  - Sữa đặc: **25 ml**
- Khách đặt size nào thì hệ thống nạp đúng định mức của size đó. Nếu đặt **2 ly size M**, lượng nguyên liệu gốc = `2 × (20g cà phê + 30ml sữa tươi + 25ml sữa đặc) = 40g cà phê + 60ml sữa tươi + 50ml sữa đặc`.

### 2. Cách tính khi khách chọn thêm Topping:
- Trong database, bảng `topping_recipes` lưu định mức nguyên liệu cho 1 phần của từng loại topping (`topping_id`).
- Ví dụ:
  - Topping **Espresso shot**: Cần **10 g** Cà phê.
  - Topping **Kem Cheese**: Cần **20 g** Kem cheese + **15 ml** Sữa tươi.
- **Quy tắc tính cộng dồn:** Khách chọn topping nào trên mỗi ly thì định mức của topping đó được cộng vào định mức của ly đó.
- **Ví dụ cụ thể:** Khách đặt **2 ly Bạc xỉu size M**, mỗi ly chọn cả **Espresso shot** và **Kem Cheese**:
  - **Cà phê:** `2 × (20g gốc + 10g espresso) = 60 g`
  - **Sữa tươi:** `2 × (30ml gốc + 15ml cheese) = 90 ml`
  - **Sữa đặc:** `2 × 25ml gốc = 50 ml`
  - **Kem cheese:** `2 × 20g cheese = 40 g`
- Công thức tổng quát được code trong hàm `InventoryService.demand()`:
  $$\text{Tổng nhu cầu nguyên liệu } X = \sum_{\text{mỗi dòng món}} \Big[ \text{Số lượng ly} \times \big( \text{Định mức size} + \sum \text{Định mức topping} \big) \Big]$$

### 3. Cách trừ trong kho khi đặt hàng:
- Việc trừ kho được thực hiện ngay trong hàm `OrdersService.create()` bên trong một **Database Transaction (`tx`)**:
  1. Tính tổng nhu cầu của tất cả nguyên liệu trong giỏ hàng.
  2. Dùng thuật toán **Optimistic Locking (Khóa lạc quan)**: Kiểm tra `stock >= demand` và `version = current_version`.
  3. Cập nhật trừ tồn kho `stock = stock - demand` và tăng `version = version + 1`.
  4. Nếu bất kỳ nguyên liệu nào không đủ tồn kho hoặc có đơn hàng khác vừa tranh mua trước, hệ thống lập tức ném lỗi `409 Conflict` và **Rollback toàn bộ**, không có tình trạng bị trừ kho dở dang.
  5. Khi trừ kho thành công, hệ thống lưu một bản chụp bất biến vào bảng `order_ingredient_usage`.

### 4. Xử lý kho khi Hủy đơn (Cancel) và Thử lại thanh toán (Retry):
- **Hủy đơn bình thường (PENDING hoặc PAID):** Hoàn trả lại chính xác lượng nguyên liệu đã trừ từ bảng snapshot `order_ingredient_usage`.
- **Hủy đơn khi đang pha chế (PREPARING):** Nguyên liệu xem như **đã đem đi pha chế và đã tiêu hao**, hệ thống **KHÔNG hoàn lại nguyên liệu vào kho** (giữ nguyên tính thực tế của quán cà phê).
- **Thử lại thanh toán (Retry khi PAYMENT_FAILED -> PENDING):** Hệ thống đọc lại chính xác snapshot ban đầu để trừ lại kho, không bị ảnh hưởng kể cả khi Barista vừa cập nhật công thức mới.
