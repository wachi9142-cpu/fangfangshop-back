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

บัญชีเริ่มต้น (รหัสผ่าน `1234` ทุกบัญชี): `owner` (เจ้าของร้าน), `staff` (พนักงานขาย),
`wi` (วิ), `toey` (เตย), `fang` (ฟ่าง), `ree` (รี)

## Endpoints

| Method | Path | ต้องล็อกอิน | หน้าที่ |
|--------|------|:-----------:|---------|
| GET    | `/products`             | – | รายการสินค้าทั้งหมด |
| GET    | `/users`                | – | รายชื่อคนในบ้าน (ชื่อ + รูปประจำตัว) |
| GET    | `/images/:id`           | – | ดูรูปที่อัปไว้ |
| POST   | `/auth/login`           | – | ล็อกอิน → `{ token, username, displayName, avatarUrl? }` |
| POST   | `/auth/logout`          | ✓ | ลบ session |
| GET    | `/auth/me`              | ✓ | ใครล็อกอินอยู่ + ชื่อ/รูปล่าสุด |
| PATCH  | `/auth/me`              | ✓ | แก้ชื่อที่แสดง / รูปประจำตัวของตัวเอง |
| POST   | `/auth/change-password` | ✓ | เปลี่ยนรหัสผ่านตัวเอง |
| POST   | `/products`             | ✓ | เพิ่มสินค้า |
| PATCH  | `/products/:id`         | ✓ | แก้สต็อก/ราคา/ข้อมูล (`imageUrl: null` = ลบรูปที่ตั้งเอง) |
| POST   | `/images`               | ✓ | อัปโหลดรูป → `{ id, url, mime, byteSize }` |
| GET    | `/images`               | ✓ | รายการรูปที่อัปไว้ |
| DELETE | `/images/:id`           | ✓ | ลบรูป (409 ถ้ายังมีคนใช้อยู่) |

endpoint ที่ต้องล็อกอินให้ส่ง header `Authorization: Bearer <token>`

### รูปภาพ

รูปเก็บกลางไว้ใน Postgres ทุกเครื่องจึงเห็นรูปเดียวกัน (แทนที่จะเก็บใน IndexedDB ของแต่ละเครื่อง)
อัปได้ทั้ง `multipart/form-data` (field `file`) และ JSON `{ dataUrl }` — รับ png/jpeg/webp/gif/avif
ไม่เกิน 2 MB — แล้วเอา `url` ที่ได้ไปใส่ `imageUrl` ของสินค้า หรือ `avatarUrl` ของคน

```bash
curl -X POST http://localhost:4001/images \
  -H "Authorization: Bearer $TOKEN" -F "file=@rup.png;type=image/png"
```

รายละเอียดเพิ่มเติม (data model, สถาปัตยกรรม) อยู่ใน **[AGENTS.md](./AGENTS.md)**
Frontend อยู่ที่ repo `../fangfangshop` (Next.js + Ant Design)
