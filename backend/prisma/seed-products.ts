import type { Prisma } from '@prisma/client';

// Stable UUIDs make repeated seeds additive without changing existing stock/prices.
// Images are original sample SVG illustrations served from frontend/public.
export const sampleProducts = [
  {
    id: '31a650c7-8597-4a01-a8e2-000000000001',
    name: 'Bạc xỉu 3 tầng Sài Gòn',
    price: 29000,
    imageUrl: '/images/products/sample-milk-coffee.svg',
    stock: 40,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000002',
    name: 'Cà phê muối kem béo',
    price: 32000,
    imageUrl: '/images/products/sample-latte.svg',
    stock: 30,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000003',
    name: 'Trà đào cam sả tươi mát',
    price: 35000,
    imageUrl: '/images/products/sample-iced-tea.svg',
    stock: 35,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000004',
    name: 'Trà mãng cầu đậm vị',
    price: 35000,
    imageUrl: '/images/products/sample-iced-tea.svg',
    stock: 25,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000005',
    name: 'Trà sữa Oolong nướng',
    price: 32000,
    imageUrl: '/images/products/sample-milk-coffee.svg',
    stock: 30,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000006',
    name: 'Matcha latte kem trứng cháy',
    price: 39000,
    imageUrl: '/images/products/sample-matcha.svg',
    stock: 20,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000007',
    name: 'Cold brew cam vàng hảo hạng',
    price: 39000,
    imageUrl: '/images/products/sample-iced-tea.svg',
    stock: 25,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000008',
    name: 'Trà vải hoa hồng tinh tế',
    price: 35000,
    imageUrl: '/images/products/sample-iced-tea.svg',
    stock: 30,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000009',
    name: 'Cacao sữa đá hạnh nhân',
    price: 30000,
    imageUrl: '/images/products/sample-cacao.svg',
    stock: 30,
  },
  {
    id: '31a650c7-8597-4a01-a8e2-000000000010',
    name: 'Trà chanh giã tay Quảng Đông',
    price: 25000,
    imageUrl: '/images/products/sample-iced-tea.svg',
    stock: 50,
  },
] satisfies Prisma.ProductCreateManyInput[];
