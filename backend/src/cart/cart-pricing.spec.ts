import { UnprocessableEntityException } from '@nestjs/common';
import { productDetailFixture } from '../../test/fixtures/product-detail';
import { assertSelection, cartConfigKey, priceSelection } from './cart-pricing';

const product = { ...productDetailFixture(), stock: 10 };
const [espresso, cheese] = product.toppings.map((option) => option.topping.id);

describe('cart pricing', () => {
  it('computes base + size + toppings as integer VND', () => {
    const priced = priceSelection(product, { size: 'M', toppingIds: [espresso] });
    expect(priced).toEqual({
      unitPrice: 29000 + 4000 + 7000,
      sizeName: 'Vừa (M)',
      toppings: [{ id: espresso, name: 'Thêm espresso', extraPrice: 7000 }],
      problems: [],
    });
  });

  it('ignores duplicated or uppercase topping ids when pricing', () => {
    expect(priceSelection(product, { size: 'S', toppingIds: [espresso, espresso.toUpperCase()] }).unitPrice).toBe(36000);
  });

  it('reports unavailable size/topping and foreign toppings', () => {
    const priced = priceSelection(product, { size: 'L', toppingIds: [cheese, '00000000-0000-4000-8000-000000000000'] });
    expect(priced.problems).toEqual(['Size L tạm hết', 'Topping không thuộc món này', 'Kem cheese tạm hết']);
    expect(() => assertSelection(product, { size: 'L', toppingIds: [] })).toThrow(UnprocessableEntityException);
  });

  it('builds the same config key regardless of topping order or note padding', () => {
    const a = cartConfigKey({ size: 'M', toppingIds: [cheese, espresso], ice: '70% đá', sugar: 'Không đường', note: ' ít ngọt ' });
    const b = cartConfigKey({ size: 'M', toppingIds: [espresso.toUpperCase(), cheese], ice: '70% đá', sugar: 'Không đường', note: 'ít ngọt' });
    expect(a).toBe(b);
    expect(a).not.toBe(cartConfigKey({ size: 'L', toppingIds: [cheese, espresso], ice: '70% đá', sugar: 'Không đường', note: 'ít ngọt' }));
  });
});
