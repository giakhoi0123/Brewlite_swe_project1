import { Prisma } from '@prisma/client';
import { evaluateSelectionPreview } from './selection-preview';
import { productDetailFixture } from '../../test/fixtures/product-detail';
import type { ProductDetailRecord } from './product-detail';
import type { CreateOrderItemDto } from '../orders/dto/create-order.dto';

const dec = (v: number | string) => new Prisma.Decimal(v);

describe('evaluateSelectionPreview', () => {
  const milkId = '90000000-0000-4000-8000-000000000001';
  const coffeeId = '90000000-0000-4000-8000-000000000002';

  let product: ProductDetailRecord;
  let ingredients: Map<string, { id: string; name: string; unit: string; stock: Prisma.Decimal }>;

  beforeEach(() => {
    product = productDetailFixture();
    // Setup Latte S: 10g coffee + 50ml milk
    // Setup Latte M: 15g coffee + 70ml milk
    // Setup Latte L: 20g coffee + 90ml milk
    const sizeS = product.sizes.find((s) => s.code === 'S')!;
    const sizeM = product.sizes.find((s) => s.code === 'M')!;
    const sizeL = product.sizes.find((s) => s.code === 'L')!;
    sizeS.available = true;
    sizeM.available = true;
    sizeL.available = true;

    sizeS.recipe = [
      { ingredientId: coffeeId, amount: dec(10), productSizeId: sizeS.id, toppingId: null, ingredient: { id: coffeeId, name: 'Cà phê rang xay', unit: 'G', stock: dec(100), version: 1 } },
      { ingredientId: milkId, amount: dec(50), productSizeId: sizeS.id, toppingId: null, ingredient: { id: milkId, name: 'Sữa tươi', unit: 'ML', stock: dec(250), version: 1 } },
    ];
    sizeM.recipe = [
      { ingredientId: coffeeId, amount: dec(15), productSizeId: sizeM.id, toppingId: null, ingredient: { id: coffeeId, name: 'Cà phê rang xay', unit: 'G', stock: dec(100), version: 1 } },
      { ingredientId: milkId, amount: dec(70), productSizeId: sizeM.id, toppingId: null, ingredient: { id: milkId, name: 'Sữa tươi', unit: 'ML', stock: dec(250), version: 1 } },
    ];
    sizeL.recipe = [
      { ingredientId: coffeeId, amount: dec(20), productSizeId: sizeL.id, toppingId: null, ingredient: { id: coffeeId, name: 'Cà phê rang xay', unit: 'G', stock: dec(100), version: 1 } },
      { ingredientId: milkId, amount: dec(90), productSizeId: sizeL.id, toppingId: null, ingredient: { id: milkId, name: 'Sữa tươi', unit: 'ML', stock: dec(250), version: 1 } },
    ];

    ingredients = new Map([
      [coffeeId, { id: coffeeId, name: 'Cà phê rang xay', unit: 'G', stock: dec(100) }],
      [milkId, { id: milkId, name: 'Sữa tươi', unit: 'ML', stock: dec(250) }],
    ]);
  });

  const makeCandidate = (extra: Partial<CreateOrderItemDto> = {}): CreateOrderItemDto => ({
    productId: product.id,
    size: 'S',
    toppingIds: [],
    quantity: 1,
    ice: '70% đá',
    sugar: '50% ít ngọt',
    note: '',
    ...extra,
  });

  it('allows buying up to 5 cups of Size S and flags shortage for the 6th cup', () => {
    // 100g coffee / 10g = 10 cups; 250ml milk / 50ml = 5 cups. Max = 5 cups.
    const res5 = evaluateSelectionPreview(makeCandidate({ quantity: 5 }), [], [product], ingredients);
    expect(res5.valid).toBe(true);
    expect(res5.canAddOne).toBe(false);
    expect(res5.maxAvailable).toBe(5);
    expect(res5.nextShortages).toHaveLength(1);
    expect(res5.nextShortages[0]).toMatchObject({
      name: 'Sữa tươi',
      unit: 'ML',
      stock: 250,
      required: 300,
      shortage: 50,
    });

    // 4 cups can add one more
    const res4 = evaluateSelectionPreview(makeCandidate({ quantity: 4 }), [], [product], ingredients);
    expect(res4.valid).toBe(true);
    expect(res4.canAddOne).toBe(true);
    expect(res4.maxAvailable).toBe(5);
    expect(res4.nextShortages).toHaveLength(0);
  });

  it('reports multiple shortages if multiple ingredients are insufficient for next cup', () => {
    // Set coffee to 55g: 5 cups needs 50g (ok), 6 cups needs 60g (short by 5g)
    ingredients.set(coffeeId, { id: coffeeId, name: 'Cà phê rang xay', unit: 'G', stock: dec(55) });
    const res = evaluateSelectionPreview(makeCandidate({ quantity: 5 }), [], [product], ingredients);
    expect(res.valid).toBe(true);
    expect(res.canAddOne).toBe(false);
    expect(res.nextShortages).toHaveLength(2);
    expect(res.nextShortages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Cà phê rang xay', shortage: 5, unit: 'G' }),
        expect.objectContaining({ name: 'Sữa tươi', shortage: 50, unit: 'ML' }),
      ]),
    );
  });

  it('marks valid=false and lists currentShortages when quantity exceeds available stock', () => {
    const res6 = evaluateSelectionPreview(makeCandidate({ quantity: 6 }), [], [product], ingredients);
    expect(res6.valid).toBe(false);
    expect(res6.canAddOne).toBe(false);
    expect(res6.maxAvailable).toBe(5);
    expect(res6.currentShortages).toHaveLength(1);
    expect(res6.currentShortages[0]).toMatchObject({
      name: 'Sữa tươi',
      shortage: 50,
      unit: 'ML',
    });
  });

  it('merges identical configurations in cart and computes additional quantity correctly', () => {
    // Cart already has 2 cups of the exact same Latte S
    const cartItem = makeCandidate({ quantity: 2 });
    // Candidate wants 3 more cups: total in cart will be 5 cups (valid), 6th cup exceeds milk
    const res3 = evaluateSelectionPreview(makeCandidate({ quantity: 3 }), [cartItem], [product], ingredients);
    expect(res3.valid).toBe(true);
    expect(res3.canAddOne).toBe(false);
    expect(res3.maxAvailable).toBe(3); // 5 total - 2 in cart = 3
    expect(res3.nextShortages[0].name).toBe('Sữa tươi');

    // Candidate wants 4 more cups: total would be 6 cups (invalid)
    const res4 = evaluateSelectionPreview(makeCandidate({ quantity: 4 }), [cartItem], [product], ingredients);
    expect(res4.valid).toBe(false);
    expect(res4.currentShortages[0].name).toBe('Sữa tươi');
  });

  it('deducts shared ingredients used by other lines in cart', () => {
    // Cart has 1 Size M: uses 70ml milk and 15g coffee
    // Remaining milk = 250 - 70 = 180ml
    // Latte S needs 50ml milk: floor(180 / 50) = 3 cups max
    const cartItemM = makeCandidate({ size: 'M', quantity: 1 });
    const res = evaluateSelectionPreview(makeCandidate({ size: 'S', quantity: 3 }), [cartItemM], [product], ingredients);
    expect(res.valid).toBe(true);
    expect(res.maxAvailable).toBe(3);
    expect(res.canAddOne).toBe(false);
    // 4 cups S would need 70 + 4*50 = 270ml -> shortage 20ml
    expect(res.nextShortages[0]).toMatchObject({
      name: 'Sữa tươi',
      shortage: 20,
    });
  });

  it('enforces business limit of 99 cups with reason MAX_REACHED', () => {
    // Infinite ingredients
    ingredients.set(coffeeId, { id: coffeeId, name: 'Cà phê rang xay', unit: 'G', stock: dec(999999) });
    ingredients.set(milkId, { id: milkId, name: 'Sữa tươi', unit: 'ML', stock: dec(999999) });

    const res99 = evaluateSelectionPreview(makeCandidate({ quantity: 99 }), [], [product], ingredients);
    expect(res99.valid).toBe(true);
    expect(res99.canAddOne).toBe(false);
    expect(res99.maxAvailable).toBe(99);
    expect(res99.reason).toBe('MAX_REACHED');
    expect(res99.nextShortages).toHaveLength(0);
  });

  it('handles size with 0 stock safely and reports shortage', () => {
    ingredients.set(milkId, { id: milkId, name: 'Sữa tươi', unit: 'ML', stock: dec(0) });
    const res = evaluateSelectionPreview(makeCandidate({ quantity: 1 }), [], [product], ingredients);
    expect(res.valid).toBe(false);
    expect(res.canAddOne).toBe(false);
    expect(res.maxAvailable).toBe(0);
    expect(res.currentShortages[0].name).toBe('Sữa tươi');
  });
});

