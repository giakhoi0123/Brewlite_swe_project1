import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { services } from '@/services';
import { cartTotal, itemKey, type CartItem } from '@/types/domain';

const data = new Map<string, string>();
const storage = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => { data.set(k, v); },
  removeItem: (k: string) => { data.delete(k); },
};
// Zustand persist đọc `window.localStorage`.
Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
// Nạp store sau khi có localStorage giả để persist ghi được.
let useCart: typeof import('./cart').useCart;
before(async () => {
  services.products.validateCart = async () => {};
  ({ useCart } = await import('./cart'));
});
beforeEach(() => { services.products.validateCart = async () => {}; });

const sizes = [
  { code: 'S' as const, name: 'Nhỏ', extraPrice: 0, available: true },
  { code: 'M' as const, name: 'Vừa', extraPrice: 6000, available: true },
  { code: 'L' as const, name: 'Lớn', extraPrice: 12000, available: true },
];
const line = (size: CartItem['size'], quantity: number, ice = '100% đá'): CartItem => ({
  key: itemKey('coffee', size, ['cream'], ice, '100% chuẩn'),
  productId: 'coffee', name: 'Cà phê sữa', imageUrl: '', size,
  toppingIds: ['cream'], toppingNames: ['Kem sữa'],
  unitPrice: 39000 + sizes.find((s) => s.code === size)!.extraPrice,
  quantity, ice, sugar: '100% chuẩn', sizeOptions: sizes,
});
const reset = async () => { await useCart.getState().clear(); data.clear(); };

test('same configuration merges quantity, different configuration adds a line', async () => {
  await reset();
  const cart = useCart.getState();
  await cart.add(line('M', 2));
  await cart.add(line('M', 1));
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(useCart.getState().items[0].quantity, 3);
  await cart.add(line('M', 1, '30% đá'));
  assert.equal(useCart.getState().items.length, 2);
  assert.equal(cartTotal(useCart.getState().items), 4 * 45000);
});

test('quantity is clamped to 1..99 and merging never exceeds 99', async () => {
  await reset();
  const cart = useCart.getState();
  await cart.add(line('S', 98));
  await cart.add(line('S', 5));
  const key = useCart.getState().items[0].key;
  assert.equal(useCart.getState().items[0].quantity, 99);
  await cart.setQuantity(key, 0);
  assert.equal(useCart.getState().items[0].quantity, 1);
  await cart.setQuantity(key, 2.7);
  assert.equal(useCart.getState().items[0].quantity, 2);
});

test('changing size recomputes the key and merges into an existing line', async () => {
  await reset();
  const cart = useCart.getState();
  await cart.add(line('S', 1));
  await cart.add(line('L', 2));
  const small = useCart.getState().items[0];
  await cart.changeSize(small.key, 'M', 45000);
  assert.deepEqual(useCart.getState().items.map((i) => i.size), ['M', 'L']);
  assert.equal(useCart.getState().items[0].key, itemKey('coffee', 'M', ['cream'], '100% đá', '100% chuẩn'));
  await cart.changeSize(useCart.getState().items[0].key, 'L', 51000);
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(useCart.getState().items[0].quantity, 3);
});

test('remove, clear and persistence to localStorage', async () => {
  await reset();
  const cart = useCart.getState();
  await cart.add(line('S', 1));
  await cart.add(line('M', 1));
  cart.setPromoCode('BREW10');
  assert.match(data.get('brewlite-cart-v1') ?? '', /BREW10/);
  cart.remove(useCart.getState().items[0].key);
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(await cart.clear(), true);
  assert.equal(useCart.getState().items.length, 0);
  assert.equal(useCart.getState().promoCode, '');
});

test('validates the merged whole cart before saving; rejects shared ingredient and topping shortages', async () => {
  await reset();
  const cart = useCart.getState();
  services.products.validateCart = async (items) => {
    // A serving of cream uses the same ingredient as coffee in this scenario.
    const demand = items.reduce((n, i) => n + i.quantity * ((i.size === 'L' ? 30 : 10) + i.toppingIds.length * 10), 0);
    if (demand > 360) throw new Error('Không đủ nguyên vật liệu: Cà phê');
  };
  assert.equal(await cart.add(line('S', 10)), true);
  assert.equal(await cart.add(line('L', 4)), true);
  assert.equal(await cart.add(line('S', 1)), false);
  assert.equal(await cart.setQuantity(useCart.getState().items[0].key, 11), false);
  assert.equal(await cart.changeSize(useCart.getState().items[0].key, 'L', 51000), false);
  assert.deepEqual(useCart.getState().items.map((i) => i.quantity), [10, 4]);
  assert.match(useCart.getState().error, /Không đủ/);
  services.products.validateCart = async () => { throw new Error('Network error'); };
  assert.equal(await cart.setQuantity(useCart.getState().items[0].key, 9), true);
});

test('serializes double clicks and does not resurrect items removed while a check is pending', async () => {
  await reset();
  await useCart.getState().add(line('S', 1));
  let finish!: () => void;
  services.products.validateCart = () => new Promise<void>((resolve) => { finish = resolve; });
  const pending = useCart.getState().add(line('S', 1));
  assert.equal(await useCart.getState().add(line('S', 1)), false);
  await useCart.getState().clear();
  finish();
  assert.equal(await pending, false);
  assert.equal(useCart.getState().items.length, 0);
});
