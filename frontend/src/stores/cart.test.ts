import test, { before } from 'node:test';
import assert from 'node:assert/strict';
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
  ({ useCart } = await import('./cart'));
});

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
  cart.add(line('M', 2));
  cart.add(line('M', 1));
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(useCart.getState().items[0].quantity, 3);
  cart.add(line('M', 1, '30% đá'));
  assert.equal(useCart.getState().items.length, 2);
  assert.equal(cartTotal(useCart.getState().items), 4 * 45000);
});

test('quantity is clamped to 1..99 and merging never exceeds 99', async () => {
  await reset();
  const cart = useCart.getState();
  cart.add(line('S', 98));
  cart.add(line('S', 5));
  const key = useCart.getState().items[0].key;
  assert.equal(useCart.getState().items[0].quantity, 99);
  cart.setQuantity(key, 0);
  assert.equal(useCart.getState().items[0].quantity, 1);
  cart.setQuantity(key, 2.7);
  assert.equal(useCart.getState().items[0].quantity, 2);
});

test('changing size recomputes the key and merges into an existing line', async () => {
  await reset();
  const cart = useCart.getState();
  cart.add(line('S', 1));
  cart.add(line('L', 2));
  const small = useCart.getState().items[0];
  cart.changeSize(small.key, 'M', 45000);
  assert.deepEqual(useCart.getState().items.map((i) => i.size), ['M', 'L']);
  assert.equal(useCart.getState().items[0].key, itemKey('coffee', 'M', ['cream'], '100% đá', '100% chuẩn'));
  cart.changeSize(useCart.getState().items[0].key, 'L', 51000);
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(useCart.getState().items[0].quantity, 3);
});

test('remove, clear and persistence to localStorage', async () => {
  await reset();
  const cart = useCart.getState();
  cart.add(line('S', 1));
  cart.add(line('M', 1));
  cart.setPromoCode('BREW10');
  assert.match(data.get('brewlite-cart-v1') ?? '', /BREW10/);
  cart.remove(useCart.getState().items[0].key);
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(await cart.clear(), true);
  assert.equal(useCart.getState().items.length, 0);
  assert.equal(useCart.getState().promoCode, '');
});
