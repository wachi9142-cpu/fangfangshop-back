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

  // token ล็อกอินแบบง่าย — เก็บเป็น session ในตาราง (ไม่ใช้ JWT)
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token        TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // บัญชีพนักงานเริ่มต้น (ตรงกับที่ frontend เคย hardcode: owner/1234, staff/1234)
  const defaultAccounts = [
    { username: "owner", password: "1234", displayName: "เจ้าของร้าน" },
    { username: "staff", password: "1234", displayName: "พนักงานขาย" }
  ];

  for (const account of defaultAccounts) {
    const hash = await Bun.password.hash(account.password);
    await sql`
      INSERT INTO users (username, password_hash, display_name)
      VALUES (${account.username}, ${hash}, ${account.displayName})
      ON CONFLICT (username) DO NOTHING
    `;
  }

  console.log("✅ สร้างตาราง products/users/sessions และบัญชีพนักงานเริ่มต้นเรียบร้อย");
  await sql.end();
}

init().catch((error) => {
  console.error("❌ db-init ล้มเหลว:", error);
  process.exit(1);
});
