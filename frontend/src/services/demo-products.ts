import imageUrls from "./demo-image-urls.json";
import type { Product } from "@/types/domain";
const sizes: Product["sizes"] = [
  { code: "S", name: "Nhỏ", extraPrice: 0, available: true, isDefault: true },
  { code: "M", name: "Vừa", extraPrice: 8000, available: true },
  { code: "L", name: "Lớn", extraPrice: 15000, available: true },
];
const toppings: Product["toppings"] = [
  { id: "pearl", name: "Trân châu", extraPrice: 7000, available: true },
  { id: "cream", name: "Kem sữa", extraPrice: 10000, available: true },
  { id: "jelly", name: "Thạch cà phê", extraPrice: 6000, available: true },
];
const rows: [string, string, number, string, string, number][] = [
  [
    "ca-phe-sua",
    "Cà phê sữa đá Sài Gòn",
    45000,
    "Cà phê Phin",
    "Đậm đà Robusta, hòa quyện sữa đặc Việt Nam.",
    20,
  ],
  [
    "americano",
    "Americano",
    39000,
    "Cà phê Máy",
    "Espresso kéo dài cùng nước nóng thanh nhẹ.",
    20,
  ],
  [
    "cappuccino",
    "Cappuccino",
    49000,
    "Cà phê Máy",
    "Espresso, sữa nóng và lớp bọt mịn.",
    20,
  ],
  [
    "tra-dao",
    "Trà đào cam sả",
    45000,
    "Trà & Khác",
    "Trà thơm dịu với đào, cam và sả.",
    20,
  ],
  [
    "bac-xiu",
    "Bạc xỉu ba tầng",
    49000,
    "Cà phê Phin",
    "Vị sữa béo dịu, cà phê thơm.",
    20,
  ],
  [
    "matcha-latte",
    "Matcha Latte Nhật Bản",
    55000,
    "Trà & Khác",
    "Matcha thanh mát cùng sữa tươi.",
    20,
  ],
  [
    "cold-brew-cam",
    "Cold Brew Cam Vàng",
    55000,
    "Cà phê Máy",
    "Cà phê ủ lạnh và cam vàng.",
    0,
  ],
  [
    "caramel-macchiato",
    "Caramel Macchiato",
    59000,
    "Cà phê Máy",
    "Espresso, sữa và caramel.",
    20,
  ],
];
export const demoProducts: Product[] = rows.map(
  ([id, name, price, category, description, stock], i) => ({
    id,
    name,
    price,
    category,
    description,
    stock,
    imageUrl: imageUrls[i],
    sizes,
    toppings,
  }),
);
