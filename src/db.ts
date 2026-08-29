import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("ไม่พบ DATABASE_URL ใน .env — คัดลอก .env.example เป็น .env ก่อน");
}

// ใช้ postgres.js เป็นไคลเอนต์ (เสถียรบน Bun/Windows) — API เป็น tagged template เหมือนกัน
export const sql = postgres(databaseUrl, { onnotice: () => {} });

// ---- ชนิดข้อมูลที่ตรงกับ type Product ฝั่ง frontend ----
export type Product = {
  id: number;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price: number;
  updatedBy: string;
  sizeLabel?: string;
  imageUrl?: string;
  isPlaceholder?: boolean;
};

// แถวจาก DB เป็น snake_case — แปลงให้เป็น camelCase ตาม contract ของ frontend
type ProductRow = {
  id: string | number;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  price: number;
  updated_by: string;
  size_label: string | null;
  image_url: string | null;
  is_placeholder: boolean;
};

export function rowToProduct(row: ProductRow): Product {
  const product: Product = {
    id: Number(row.id),
    name: row.name,
    category: row.category,
    stock: row.stock,
    minStock: row.min_stock,
    unit: row.unit,
    price: row.price,
    updatedBy: row.updated_by
  };

  if (row.size_label) product.sizeLabel = row.size_label;
  if (row.image_url) product.imageUrl = row.image_url;
  if (row.is_placeholder) product.isPlaceholder = true;

  return product;
}
