# fangfangshop-back

Backend / API ของ **Fang Fang Shop** — เว็บแอปมือถือที่แสดงรายการสินค้า ราคา
และจำนวนสต็อกของร้านของชำ

**Stack:** Bun + Hono + PostgreSQL (`postgres.js`)

## เริ่มใช้งาน

1. ติดตั้ง dependencies

   ```bash
   bun install
   ```

2. ตั้งค่า `.env` (คัดลอกจาก `.env.example`) ให้ `DATABASE_URL` ชี้ไป Postgres ของคุณ
   และมี database ชื่อ `fangfangshop` อยู่แล้ว

   ```bash
   createdb fangfangshop   # หรือ CREATE DATABASE fangfangshop; ใน psql
   ```

3. สร้างตาราง + บัญชีพนักงาน + seed สินค้า (ครั้งแรกครั้งเดียว)

   ```bash
   bun run db:setup
   ```

4. รัน API

   ```bash
   bun run dev      # watch mode, http://localhost:4001
   ```

บัญชีทดสอบ: `owner` / `1234`, `staff` / `1234`

## Endpoints

| Method | Path | ต้องล็อกอิน | หน้าที่ |
|--------|------|:-----------:|---------|
| GET   | `/products`      | – | รายการสินค้าทั้งหมด |
| POST  | `/auth/login`    | – | ล็อกอิน → `{ token, username, displayName }` |
| POST  | `/auth/logout`   | ✓ | ลบ session |
| POST  | `/products`      | ✓ | เพิ่มสินค้า |
| PATCH | `/products/:id`  | ✓ | แก้สต็อก/ราคา/ข้อมูล |

endpoint ที่ต้องล็อกอินให้ส่ง header `Authorization: Bearer <token>`

รายละเอียดเพิ่มเติม (data model, สถาปัตยกรรม) อยู่ใน **[AGENTS.md](./AGENTS.md)**
Frontend อยู่ที่ repo `../fangfangshop` (Next.js + Ant Design)
