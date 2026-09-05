// สร้างตารางทั้งหมด + บัญชีพนักงานเริ่มต้น (idempotent — รันซ้ำได้)
import { sql } from "./db.ts";

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id             BIGINT PRIMARY KEY,
      name           TEXT    NOT NULL,
      category       TEXT    NOT NULL,
      stock          INTEGER NOT NULL DEFAULT 0,
      min_stock      INTEGER NOT NULL DEFAULT 0,
      unit           TEXT    NOT NULL DEFAULT 'ชิ้น',
      price          INTEGER NOT NULL DEFAULT 0,
      updated_by     TEXT    NOT NULL DEFAULT 'เจ้าของร้าน',
      size_label     TEXT,
      image_url      TEXT,
      is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // id ของสินค้าใหม่ที่เพิ่มผ่าน API — เริ่มสูงๆ กันชนกับ id ที่ seed มา
  await sql`CREATE SEQUENCE IF NOT EXISTS product_id_seq START WITH 100000000`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name  TEXT NOT NULL
    )
  `;

  // รูปประจำตัว: เก็บได้ทั้ง preset ของ frontend (เช่น "preset:cat-1")
  // และรูปที่อัปโหลดเอง (เช่น "/images/<sha256>")
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;

  // token ล็อกอินแบบง่าย — เก็บเป็น session ในตาราง (ไม่ใช้ JWT)
  // display_name ในตารางนี้เก็บไว้เพื่อความเข้ากันได้เท่านั้น
  // ค่าที่ใช้จริงอ่านจากตาราง users เสมอ (เปลี่ยนชื่อ/รูปแล้วเห็นผลทันที)
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token        TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ---- คลังรูปภาพ (ใช้ร่วมกันทุกเครื่อง แทน IndexedDB ในเครื่องใครเครื่องมัน) ----
  // id = sha256 ของไฟล์ → รูปเดียวกันอัปซ้ำกี่ครั้งก็เก็บก้อนเดียว และ cache ได้ถาวร
  await sql`
    CREATE TABLE IF NOT EXISTS images (
      id          TEXT PRIMARY KEY,
      mime        TEXT NOT NULL,
      byte_size   INTEGER NOT NULL,
      data        BYTEA NOT NULL,
      kind        TEXT NOT NULL DEFAULT 'product',
      uploaded_by TEXT NOT NULL DEFAULT 'ไม่ทราบ',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS images_created_at_idx ON images (created_at DESC)`;

  // บัญชีเริ่มต้น: บัญชีระบบ + คนในบ้าน (วิ / เตย / ฟ่าง / รี)
  const defaultAccounts = [
    { username: "owner", password: "1234", displayName: "เจ้าของร้าน" },
    { username: "staff", password: "1234", displayName: "พนักงานขาย" },
    { username: "wi", password: "1234", displayName: "วิ" },
    { username: "toey", password: "1234", displayName: "เตย" },
    { username: "fang", password: "1234", displayName: "ฟ่าง" },
    { username: "ree", password: "1234", displayName: "รี" }
  ];

  for (const account of defaultAccounts) {
    const hash = await Bun.password.hash(account.password);
    await sql`
      INSERT INTO users (username, password_hash, display_name)
      VALUES (${account.username}, ${hash}, ${account.displayName})
      ON CONFLICT (username) DO NOTHING
    `;
  }

  console.log("✅ สร้างตาราง products/users/sessions/images และบัญชีเริ่มต้นเรียบร้อย");
  console.log("   บัญชีคนในบ้าน: wi=วิ, toey=เตย, fang=ฟ่าง, ree=รี (รหัสผ่านเริ่มต้น 1234)");
  await sql.end();
}

init().catch((error) => {
  console.error("❌ db-init ล้มเหลว:", error);
  process.exit(1);
});
