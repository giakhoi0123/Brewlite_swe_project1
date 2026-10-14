import type { ProductDetailRecord } from '../../src/products/product-detail';

export function productDetailFixture(): ProductDetailRecord {
  return {
    id: '31a650c7-8597-4a01-a8e2-000000000001',
    name: 'Bạc xỉu 3 tầng Sài Gòn',
    description: 'Cà phê và sữa, phục vụ lạnh.',
    imageUrl: '/images/products/sample-milk-coffee.svg',
    price: 29000,
    sizes: [
      { id: 'c075421a-1160-4e94-84d4-000000000001', code: 'S', name: 'Nhỏ (S)', extraPrice: 0, available: true, isDefault: false },
      { id: 'c075421a-1160-4e94-84d4-000000000002', code: 'M', name: 'Vừa (M)', extraPrice: 4000, available: true, isDefault: true },
      { id: 'c075421a-1160-4e94-84d4-000000000003', code: 'L', name: 'Lớn (L)', extraPrice: 9000, available: false, isDefault: false },
    ],
    toppings: [
      { topping: { id: 'b4151b67-4044-43ce-9cac-000000000001', name: 'Thêm espresso' }, extraPrice: 7000, available: true },
      { topping: { id: 'b4151b67-4044-43ce-9cac-000000000002', name: 'Kem cheese' }, extraPrice: 6000, available: false },
    ],
  };
}
