import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { sql, rowToProduct, type Product } from "./db.ts";
import {
  MAX_IMAGE_BYTES,
  extensionFor,
  normalizeImageId,
  readUpload,
  sha256Hex
} from "./images.ts";

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
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
  })
);

// ---- helper: ตรวจ token จาก header Authorization: Bearer <token> ----
type SessionUser = { username: string; displayName: string; avatarUrl?: string };

type UserRow = { username: string; display_name: string | null; avatar_url: string | null };

function toSessionUser(row: UserRow): SessionUser {
  // displayName ต้องไม่เป็น null/undefined เด็ดขาด — ฝั่งหน้าเว็บเคยขึ้นชื่อว่า "undefined" เพราะค่านี้หาย
  const user: SessionUser = {
    username: row.username,
    displayName: row.display_name?.trim() || row.username
  };
  if (row.avatar_url) user.avatarUrl = row.avatar_url;
  return user;
}

// อ่านชื่อ/รูปจากตาราง users เสมอ (ไม่ใช่จาก sessions) — เปลี่ยนชื่อหรือรูปแล้วเห็นผลทันที
async function getUserFromRequest(authHeader?: string): Promise<SessionUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const rows = (await sql`
    SELECT u.username, u.display_name, u.avatar_url
    FROM sessions s
    JOIN users u ON u.username = s.username
    WHERE s.token = ${token}
  `) as UserRow[];

  if (rows.length === 0) return null;
  return toSessionUser(rows[0]);
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
    SELECT username, password_hash, display_name, avatar_url FROM users WHERE username = ${username}
  `) as (UserRow & { password_hash: string })[];

  if (rows.length === 0) {
    return c.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  const valid = await Bun.password.verify(password, rows[0].password_hash);
  if (!valid) {
    return c.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  const user = toSessionUser(rows[0]);
  const token = randomUUID();
  await sql`
    INSERT INTO sessions (token, username, display_name)
    VALUES (${token}, ${user.username}, ${user.displayName})
  `;

  return c.json({ token, ...user });
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

// ---- ใครล็อกอินอยู่: เช็คว่า token ที่เก็บไว้ยังใช้ได้ + ดึงชื่อ/รูปล่าสุด ----
app.get("/auth/me", async (c) => {
  const user = await requireAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);
  return c.json(user);
});

// ---- แก้โปรไฟล์ตัวเอง: ชื่อที่แสดง / รูปประจำตัว ----
app.patch("/auth/me", async (c) => {
  const user = await requireAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);

  const body = (await c.req.json().catch(() => null)) as
    | { displayName?: string; avatarUrl?: string | null }
    | null;
  if (!body) return c.json({ error: "ข้อมูลไม่ถูกต้อง" }, 400);

  const displayName = body.displayName?.trim();
  if (displayName !== undefined && displayName === "") {
    return c.json({ error: "ชื่อที่แสดงห้ามว่าง" }, 400);
  }

  // avatarUrl: ส่ง null มา = เอารูปออก, ไม่ส่งมาเลย = ไม่แตะของเดิม
  const avatarUrl = body.avatarUrl === undefined ? undefined : body.avatarUrl || null;

  const rows = (await sql`
    UPDATE users SET
      display_name = COALESCE(${displayName ?? null}, display_name),
      avatar_url   = ${avatarUrl === undefined ? sql`avatar_url` : avatarUrl}
    WHERE username = ${user.username}
    RETURNING username, display_name, avatar_url
  `) as UserRow[];

  if (rows.length === 0) return c.json({ error: "ไม่พบผู้ใช้" }, 404);

  // sessions เก็บชื่อไว้ด้วย — อัปเดตให้ตรงกัน จะได้ไม่มีชื่อเก่าค้าง
  await sql`
    UPDATE sessions SET display_name = ${rows[0].display_name ?? user.username}
    WHERE username = ${user.username}
  `;

  return c.json(toSessionUser(rows[0]));
});

// ---- เปลี่ยนรหัสผ่านตัวเอง (บัญชีเริ่มต้นเป็น 1234 ทุกคน ควรเปลี่ยน) ----
app.post("/auth/change-password", async (c) => {
  const user = await requireAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);

  const body = (await c.req.json().catch(() => null)) as
    | { currentPassword?: string; newPassword?: string }
    | null;
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (!currentPassword || !newPassword) {
    return c.json({ error: "กรอกรหัสผ่านเดิมและรหัสผ่านใหม่" }, 400);
  }
  if (newPassword.length < 4) {
    return c.json({ error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 4 ตัว" }, 400);
  }

  const rows = (await sql`
    SELECT password_hash FROM users WHERE username = ${user.username}
  `) as { password_hash: string }[];
  if (rows.length === 0) return c.json({ error: "ไม่พบผู้ใช้" }, 404);

  const valid = await Bun.password.verify(currentPassword, rows[0].password_hash);
  if (!valid) return c.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, 401);

  const hash = await Bun.password.hash(newPassword);
  await sql`UPDATE users SET password_hash = ${hash} WHERE username = ${user.username}`;
  // ล้าง session ทั้งหมดของคนนี้ แล้วให้ล็อกอินใหม่ด้วยรหัสใหม่
  await sql`DELETE FROM sessions WHERE username = ${user.username}`;

  return c.json({ ok: true, message: "เปลี่ยนรหัสผ่านแล้ว — กรุณาเข้าสู่ระบบใหม่" });
});

// ---- รายชื่อคนในบ้าน (ไว้ทำหน้าจอเลือกคนตอนล็อกอิน) — ไม่มีรหัสผ่านในผลลัพธ์ ----
app.get("/users", async (c) => {
  const rows = (await sql`
    SELECT username, display_name, avatar_url FROM users ORDER BY id
  `) as UserRow[];
  return c.json(rows.map(toSessionUser));
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

  // imageUrl: ส่ง null มา = ลบรูปที่ตั้งเอง กลับไปใช้รูปเริ่มต้นของ frontend
  const clearImage = body.imageUrl === null;

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
      image_url  = ${clearImage ? null : sql`COALESCE(${body.imageUrl ?? null}, image_url)`},
      updated_by = ${body.updatedBy ?? user.displayName},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `) as any[];

  if (rows.length === 0) return c.json({ error: "ไม่พบสินค้า" }, 404);
  return c.json(rowToProduct(rows[0]));
});

// ---- POST /images: อัปโหลดรูป (ต้องล็อกอิน) → { id, url } ----
// รับได้ทั้ง multipart/form-data (field ชื่อ file) และ JSON { dataUrl } หรือ { base64, mime }
app.post("/images", async (c) => {
  const user = await requireAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);

  const upload = await readUpload(c.req.raw);
  if ("error" in upload) return c.json({ error: upload.error }, upload.status);

  const kind = c.req.query("kind") === "avatar" ? "avatar" : "product";
  const id = sha256Hex(upload.bytes);

  // รูปเดียวกัน (sha256 ตรงกัน) เก็บก้อนเดียว — อัปซ้ำแล้วได้ url เดิม ไม่กินที่เพิ่ม
  await sql`
    INSERT INTO images (id, mime, byte_size, data, kind, uploaded_by)
    VALUES (
      ${id},
      ${upload.mime},
      ${upload.bytes.byteLength},
      ${Buffer.from(upload.bytes)},
      ${kind},
      ${user.displayName}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  return c.json(
    {
      id,
      url: `/images/${id}.${extensionFor(upload.mime)}`,
      mime: upload.mime,
      byteSize: upload.bytes.byteLength
    },
    201
  );
});

// ---- GET /images: รายการรูปที่อัปไว้ (ต้องล็อกอิน) — เมทาดาทาอย่างเดียว ไม่ส่งตัวไฟล์ ----
app.get("/images", async (c) => {
  const user = await requireAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);

  const limit = Math.min(Number(c.req.query("limit") ?? 100) || 100, 500);
  const rows = (await sql`
    SELECT id, mime, byte_size, kind, uploaded_by, created_at
    FROM images ORDER BY created_at DESC LIMIT ${limit}
  `) as {
    id: string;
    mime: string;
    byte_size: number;
    kind: string;
    uploaded_by: string;
    created_at: Date;
  }[];

  return c.json(
    rows.map((row) => ({
      id: row.id,
      url: `/images/${row.id}.${extensionFor(row.mime)}`,
      mime: row.mime,
      byteSize: row.byte_size,
      kind: row.kind,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at
    }))
  );
});

// ---- GET /images/:id: ดูรูป (ทุกคนดูได้) — id เป็น sha256 จึงให้ browser cache ถาวรได้ ----
app.get("/images/:id", async (c) => {
  const id = normalizeImageId(c.req.param("id"));
  if (!id) return c.json({ error: "id รูปไม่ถูกต้อง" }, 400);

  if (c.req.header("If-None-Match") === `"${id}"`) return c.body(null, 304);

  const rows = (await sql`SELECT mime, data FROM images WHERE id = ${id}`) as {
    mime: string;
    data: Uint8Array;
  }[];
  if (rows.length === 0) return c.json({ error: "ไม่พบรูป" }, 404);

  return c.body(new Uint8Array(rows[0].data), 200, {
    "Content-Type": rows[0].mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: `"${id}"`
  });
});

// ---- DELETE /images/:id: ลบรูป (ต้องล็อกอิน) — ลบไม่ได้ถ้ายังมีสินค้า/คนใช้รูปนี้อยู่ ----
app.delete("/images/:id", async (c) => {
  const user = await requireAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);

  const id = normalizeImageId(c.req.param("id"));
  if (!id) return c.json({ error: "id รูปไม่ถูกต้อง" }, 400);

  const pattern = `%/images/${id}%`;
  const used = (await sql`
    SELECT
      (SELECT count(*) FROM products WHERE image_url  LIKE ${pattern}) AS product_count,
      (SELECT count(*) FROM users    WHERE avatar_url LIKE ${pattern}) AS user_count
  `) as { product_count: string; user_count: string }[];

  if (Number(used[0].product_count) > 0 || Number(used[0].user_count) > 0) {
    return c.json({ error: "รูปนี้ยังถูกใช้อยู่ — เปลี่ยนรูปของสินค้า/คนที่ใช้อยู่ก่อน" }, 409);
  }

  const rows = (await sql`DELETE FROM images WHERE id = ${id} RETURNING id`) as { id: string }[];
  if (rows.length === 0) return c.json({ error: "ไม่พบรูป" }, 404);
  return c.json({ ok: true, id });
});

const port = Number(process.env.PORT ?? 4001);
console.log(`🚀 fangfangshop-back ทำงานที่ http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  // เผื่อรูปที่ส่งมาเป็น data URL (base64 บวมกว่าไฟล์จริง ~33%)
  maxRequestBodySize: MAX_IMAGE_BYTES * 2
};
