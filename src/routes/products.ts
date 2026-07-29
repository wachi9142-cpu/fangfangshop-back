import { Hono } from "hono";
import { prisma } from "../db";
import { requireAuth, type AuthVariables } from "../auth";

export const productRoutes = new Hono<{ Variables: AuthVariables }>();

// สถานะสต็อกคำนวณจาก stock เทียบ minStock (ให้ตรง getStatus ฝั่ง frontend)
function getStatus(stock: number, minStock: number): "พร้อมขาย" | "ใกล้หมด" | "หมด" {
  if (stock <= 0) return "หมด";
  if (stock <= minStock) return "ใกล้หมด";
  return "พร้อมขาย";
}

type ProductRow = {
  id: number;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price: number;
  updatedBy: string;
  sizeLabel: string | null;
  imageUrl: string | null;
};

// แนบ status ที่คำนวณแล้วไปกับ product เพื่อความสะดวกฝั่ง frontend
const withStatus = <T extends { stock: number; minStock: number }>(p: T) => ({
  ...p,
  status: getStatus(p.stock, p.minStock)
});

// ---- helpers สำหรับ validate ค่าที่ส่งเข้ามา ----
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isNonNegativeInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

// GET /products — รายการสินค้าทั้งหมด (สาธารณะ)
// รองรับ ?category=, ?q= (ค้นชื่อ), ?status=พร้อมขาย|ใกล้หมด|หมด
productRoutes.get("/", async (c) => {
  const category = c.req.query("category");
  const q = c.req.query("q");
  const status = c.req.query("status");

  const where: Record<string, unknown> = {};
  if (category && category !== "ทั้งหมด") where.category = category;
  if (q) where.name = { contains: q };

  let items = (await prisma.product.findMany({
    where,
    orderBy: { id: "asc" }
  })) as ProductRow[];

  let result = items.map(withStatus);
  if (status) result = result.filter((p) => p.status === status);

  return c.json(result);
});

// GET /products/:id — สินค้ารายตัว (สาธารณะ)
productRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "id ไม่ถูกต้อง" }, 400);

  const product = (await prisma.product.findUnique({ where: { id } })) as ProductRow | null;
  if (!product) return c.json({ error: "ไม่พบสินค้า" }, 404);
  return c.json(withStatus(product));
});

// POST /products — เพิ่มสินค้า (ต้องล็อกอิน)
productRoutes.post("/", requireAuth, async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, 400);
  }

  if (!isNonEmptyString(body.name)) return c.json({ error: "ต้องระบุชื่อสินค้า (name)" }, 400);
  if (!isNonEmptyString(body.category)) return c.json({ error: "ต้องระบุหมวดหมู่ (category)" }, 400);
  if (!isNonEmptyString(body.unit)) return c.json({ error: "ต้องระบุหน่วย (unit)" }, 400);

  const price = body.price ?? 0;
  const stock = body.stock ?? 0;
  const minStock = body.minStock ?? 0;
  if (!isNonNegativeInt(price)) return c.json({ error: "price ต้องเป็นจำนวนเต็ม ≥ 0" }, 400);
  if (!isNonNegativeInt(stock)) return c.json({ error: "stock ต้องเป็นจำนวนเต็ม ≥ 0" }, 400);
  if (!isNonNegativeInt(minStock)) return c.json({ error: "minStock ต้องเป็นจำนวนเต็ม ≥ 0" }, 400);

  const created = await prisma.product.create({
    data: {
      name: body.name.trim(),
      category: body.category.trim(),
      unit: body.unit.trim(),
      price,
      stock,
      minStock,
      updatedBy: isNonEmptyString(body.updatedBy) ? body.updatedBy : c.get("user").displayName,
      sizeLabel: isNonEmptyString(body.sizeLabel) ? body.sizeLabel : null,
      imageUrl: isNonEmptyString(body.imageUrl) ? body.imageUrl : null
    }
  });

  return c.json(withStatus(created as ProductRow), 201);
});

// PATCH /products/:id — แก้สต็อก/ราคา/ข้อมูลสินค้า (ต้องล็อกอิน)
productRoutes.patch("/:id", requireAuth, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "id ไม่ถูกต้อง" }, 400);

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "ไม่พบสินค้า" }, 404);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, 400);
  }

  const data: Record<string, unknown> = {};
  if ("name" in body) {
    if (!isNonEmptyString(body.name)) return c.json({ error: "name ต้องไม่ว่าง" }, 400);
    data.name = body.name.trim();
  }
  if ("category" in body) {
    if (!isNonEmptyString(body.category)) return c.json({ error: "category ต้องไม่ว่าง" }, 400);
    data.category = body.category.trim();
  }
  if ("unit" in body) {
    if (!isNonEmptyString(body.unit)) return c.json({ error: "unit ต้องไม่ว่าง" }, 400);
    data.unit = body.unit.trim();
  }
  for (const field of ["price", "stock", "minStock"] as const) {
    if (field in body) {
      if (!isNonNegativeInt(body[field])) {
        return c.json({ error: `${field} ต้องเป็นจำนวนเต็ม ≥ 0` }, 400);
      }
      data[field] = body[field];
    }
  }
  if ("sizeLabel" in body) data.sizeLabel = isNonEmptyString(body.sizeLabel) ? body.sizeLabel : null;
  if ("imageUrl" in body) data.imageUrl = isNonEmptyString(body.imageUrl) ? body.imageUrl : null;

  if (Object.keys(data).length === 0) {
    return c.json({ error: "ไม่มีฟิลด์ให้แก้ไข" }, 400);
  }

  // บันทึกว่าใครแก้ล่าสุด (ใช้ค่าที่ส่งมา หรือชื่อผู้ล็อกอิน)
  data.updatedBy = isNonEmptyString(body.updatedBy) ? body.updatedBy : c.get("user").displayName;

  const updated = await prisma.product.update({ where: { id }, data });
  return c.json(withStatus(updated as ProductRow));
});

// DELETE /products/:id — ลบสินค้า (ต้องล็อกอิน)
productRoutes.delete("/:id", requireAuth, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "id ไม่ถูกต้อง" }, 400);

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "ไม่พบสินค้า" }, 404);

  await prisma.product.delete({ where: { id } });
  return c.json({ ok: true, id });
});
