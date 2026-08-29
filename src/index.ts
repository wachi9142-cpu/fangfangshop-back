import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { sql, rowToProduct, type Product } from "./db.ts";

const app = new Hono();

const corsConfig = (process.env.CORS_ORIGIN ?? "localhost").trim();
// โหมด dev: "localhost" = สะท้อน origin ใดก็ได้ที่มาจาก localhost/127.0.0.1 (พอร์ตไหนก็ได้)
const allowAnyLocalhost = corsConfig === "" || corsConfig === "localhost";
const explicitOrigins = corsConfig.split(",").map((origin) => origin.trim());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (allowAnyLocalhost) {
        return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null;
      }
      return explicitOrigins.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
  })
);

// ---- helper: ตรวจ token จาก header Authorization: Bearer <token> ----
type SessionUser = { username: string; displayName: string };

async function getUserFromRequest(authHeader?: string): Promise<SessionUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const rows = (await sql`
    SELECT username, display_name FROM sessions WHERE token = ${token}
  `) as { username: string; display_name: string }[];

  if (rows.length === 0) return null;
  return { username: rows[0].username, displayName: rows[0].display_name };
}

// middleware สำหรับ endpoint ที่ต้องล็อกอิน
async function requireAuth(authHeader: string | undefined) {
  const user = await getUserFromRequest(authHeader);
  if (!user) return null;
  return user;
}

// ---- health check ----
app.get("/", (c) => c.json({ ok: true, service: "fangfangshop-back" }));

// ---- login แบบง่าย: username/password → token ----
app.post("/auth/login", async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim();
  const password = body?.password;

  if (!username || !password) {
    return c.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, 400);
  }

  const rows = (await sql`
    SELECT username, password_hash, display_name FROM users WHERE username = ${username}
  `) as { username: string; password_hash: string; display_name: string }[];

  if (rows.length === 0) {
    return c.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  const valid = await Bun.password.verify(password, rows[0].password_hash);
  if (!valid) {
    return c.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  const token = randomUUID();
  await sql`
    INSERT INTO sessions (token, username, display_name)
    VALUES (${token}, ${rows[0].username}, ${rows[0].display_name})
  `;

  return c.json({ token, username: rows[0].username, displayName: rows[0].display_name });
});

// ---- logout: ลบ session ----
app.post("/auth/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  }
  return c.json({ ok: true });
});

// ---- GET /products: ทุกคนดูได้ ----
app.get("/products", async (c) => {
  const rows = (await sql`SELECT * FROM products ORDER BY id`) as any[];
  return c.json(rows.map(rowToProduct));
});

// ---- POST /products: เพิ่มสินค้า (ต้องล็อกอิน) ----
app.post("/products", async (c) => {
  const user = await requireAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);

  const body = (await c.req.json().catch(() => null)) as Partial<Product> | null;
  if (!body?.name || !body?.category) {
    return c.json({ error: "ต้องมีชื่อสินค้าและหมวดหมู่" }, 400);
  }

  const idRows = (await sql`SELECT nextval('product_id_seq') AS id`) as { id: string }[];
  const id = Number(idRows[0].id);

  const rows = (await sql`
    INSERT INTO products (id, name, category, stock, min_stock, unit, price, updated_by, size_label, image_url, is_placeholder)
    VALUES (
      ${id},
      ${body.name},
      ${body.category},
      ${body.stock ?? 0},
      ${body.minStock ?? 0},
      ${body.unit ?? "ชิ้น"},
      ${body.price ?? 0},
      ${body.updatedBy ?? user.displayName},
      ${body.sizeLabel ?? null},
      ${body.imageUrl ?? null},
      ${body.isPlaceholder ?? false}
    )
    RETURNING *
  `) as any[];

  return c.json(rowToProduct(rows[0]), 201);
});

// ---- PATCH /products/:id: แก้สต็อก/ราคา/ข้อมูล (ต้องล็อกอิน) ----
app.patch("/products/:id", async (c) => {
  const user = await requireAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "id ไม่ถูกต้อง" }, 400);

  const body = (await c.req.json().catch(() => null)) as Partial<Product> | null;
  if (!body) return c.json({ error: "ข้อมูลไม่ถูกต้อง" }, 400);

  // อัปเดตเฉพาะ field ที่ส่งมา (COALESCE — ถ้าไม่ส่งใช้ค่าเดิม)
  const rows = (await sql`
    UPDATE products SET
      name       = COALESCE(${body.name ?? null}, name),
      category   = COALESCE(${body.category ?? null}, category),
      stock      = COALESCE(${body.stock ?? null}, stock),
      min_stock  = COALESCE(${body.minStock ?? null}, min_stock),
      unit       = COALESCE(${body.unit ?? null}, unit),
      price      = COALESCE(${body.price ?? null}, price),
      size_label = COALESCE(${body.sizeLabel ?? null}, size_label),
      image_url  = COALESCE(${body.imageUrl ?? null}, image_url),
      updated_by = ${body.updatedBy ?? user.displayName},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `) as any[];

  if (rows.length === 0) return c.json({ error: "ไม่พบสินค้า" }, 404);
  return c.json(rowToProduct(rows[0]));
});

const port = Number(process.env.PORT ?? 3001);
console.log(`🚀 fangfangshop-back ทำงานที่ http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch
};
