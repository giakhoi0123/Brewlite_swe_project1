import { cartConfigKey, normalizeToppingIds } from './cart-pricing';

describe('Scoped Cart Cleanup on Payment Success', () => {
  it('does not wipe newly added or un-ordered cart items after payment is PAID', async () => {
    // Simulated cart in database
    const cart = {
      id: 'cart-1',
      userId: 'user-1',
      items: [
        {
          id: 'ci-1',
          productId: 'prod-1',
          size: 'M' as any,
          toppingIds: [],
          ice: '100% đá',
          sugar: '100% chuẩn',
          note: '',
          configKey: cartConfigKey({
            size: 'M' as any,
            toppingIds: [],
            ice: '100% đá',
            sugar: '100% chuẩn',
            note: '',
          }),
          quantity: 2,
        },
        {
          id: 'ci-2',
          productId: 'prod-2', // Added while waiting for payment
          size: 'S' as any,
          toppingIds: [],
          ice: '100% đá',
          sugar: '100% chuẩn',
          note: 'Món mới thêm',
          configKey: cartConfigKey({
            size: 'S' as any,
            toppingIds: [],
            ice: '100% đá',
            sugar: '100% chuẩn',
            note: 'Món mới thêm',
          }),
          quantity: 1,
        },
      ],
    };

    // The paid order only contains 1 cup of prod-1
    const orderWithItems = {
      id: 'order-1',
      items: [
        {
          productId: 'prod-1',
          size: 'M' as any,
          toppings: [],
          ice: '100% đá',
          sugar: '100% chuẩn',
          note: '',
          qty: 1,
        },
      ],
    };

    const deletedItemIds: string[] = [];
    const updatedQuantities = new Map<string, number>();

    // Execute scoped cleanup logic
    for (const item of orderWithItems.items) {
      const toppingIds = normalizeToppingIds(item.toppings.map((t: any) => t.toppingId));
      const configKey = cartConfigKey({
        size: item.size,
        toppingIds,
        ice: item.ice,
        sugar: item.sugar,
        note: item.note ?? '',
      });
      const cartItem = cart.items.find(
        (ci) => ci.productId === item.productId && ci.configKey === configKey,
      );
      if (cartItem) {
        if (cartItem.quantity <= item.qty) {
          deletedItemIds.push(cartItem.id);
        } else {
          updatedQuantities.set(cartItem.id, cartItem.quantity - item.qty);
        }
      }
    }

    // Assertions
    // ci-1 quantity was reduced from 2 to 1 (not deleted)
    expect(updatedQuantities.get('ci-1')).toBe(1);
    expect(deletedItemIds).not.toContain('ci-1');

    // ci-2 (newly added item) was NOT touched or deleted!
    expect(deletedItemIds).not.toContain('ci-2');
    expect(updatedQuantities.has('ci-2')).toBe(false);
  });
});

