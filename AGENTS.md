# AGENTS.md — Fang Fang Shop (Backend)

> เอกสารสำหรับ AI agent ทุกตัว (รวมถึง Claude Code) และนักพัฒนา
> อ่านไฟล์นี้ก่อนเริ่มงานเสมอ

---

## 1. โปรเจกต์นี้คืออะไร (What this project is)

`fangfangshop-back` คือ **backend / API ของแอป Fang Fang Shop**

Fang Fang Shop เป็น **เว็บแอปสำหรับมือถือ** ที่แสดง **รายการสินค้า ราคา และจำนวนสต็อก**
ของร้านของชำแห่งหนึ่ง โดยมีสองกลุ่มผู้ใช้:

- **ผู้ใช้ทั่วไป (ไม่ล็อกอิน):** ดูรายการสินค้า ราคา และสต็อกปัจจุบันได้อย่างเดียว
- **พนักงาน/เจ้าของร้าน (ล็อกอินแล้ว):** จัดการสต็อก เพิ่ม/แก้ไขสินค้า อัปเดตจำนวนเมื่อเติมของ

Backend นี้มีหน้าที่ให้บริการข้อมูลและ logic ที่ฝั่ง frontend ต้องใช้ เช่น:

- เก็บ/ให้ข้อมูลสินค้า (catalog: ชื่อ ราคา หมวดหมู่ รูป สต็อก ฯลฯ)
- อัปเดตจำนวนสต็อกและราคา
- ระบบล็อกอิน **แบบง่าย** (username / password) เพื่อแยกสิทธิ์ "ดูอย่างเดียว" vs "แก้ไขได้"
  — ตั้งใจให้เรียบง่าย ไม่ต้องมี auth ที่ซับซ้อน

> Repo ฝั่ง frontend อยู่ที่ `../fangfangshop` (Next.js + Ant Design)
> ให้ยึด `type Product` และแนวคิดในฝั่ง frontend เป็นสัญญา (contract) ของข้อมูล

---

## 2. สถานะปัจจุบัน (Current state)

✅ **backend สร้างเสร็จแล้วและเชื่อมกับ frontend เรียบร้อย**

- **Stack:** Bun + Hono + PostgreSQL (ไคลเอนต์ DB ใช้ `postgres.js`)
- **Data:** ย้าย catalog จริง 414 รายการจาก frontend มาเก็บใน Postgres แล้ว
  (seed มาจาก `src/seed-products.json` ที่ export จาก catalog ของ frontend)
- **Auth:** ล็อกอิน username/password แบบง่าย → คืน token (เก็บเป็น session ในตาราง)
- **Frontend:** `../fangfangshop` เรียก API ผ่าน `app/api.ts` (ตั้งค่า URL ที่ `.env.local`)

> ⚠️ **หมายเหตุความปลอดภัย (ยอมรับได้สำหรับร้านเล็ก แต่ควรรู้):** token ยังไม่มีวันหมดอายุ,
> ยังไม่มี rate-limit. ถ้าจะขึ้น production จริงควรเพิ่มส่วนนี้และเปลี่ยนรหัสผ่านเริ่มต้น

### สถาปัตยกรรมโดยย่อ

```
Browser ── GET /products (ทุกคน) ─────────────┐
        ── POST /auth/login → token           │
        ── POST /products     (Bearer token)  ├──►  Hono (Bun)  ──►  PostgreSQL
        ── PATCH /products/:id (Bearer token) ┘         (fangfangshop DB)
```

### ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|------|---------|
| `src/index.ts`   | Hono app + ทุก endpoint + auth middleware + CORS |
| `src/db.ts`      | เชื่อม Postgres (postgres.js) + แปลง row → `Product` |
| `src/images.ts`  | คลังรูป: อ่าน/ตรวจไฟล์ที่อัปเข้ามา (ชนิด, ขนาด, sha256) |
| `src/db-init.ts` | สร้างตาราง products/users/sessions/images + บัญชีเริ่มต้น |
| `src/seed.ts`    | นำเข้า catalog จาก `seed-products.json` (upsert ตาม id) |
| `.env`           | `DATABASE_URL`, `PORT`, `CORS_ORIGIN` (อยู่ใน .gitignore) |

> **พอร์ต — จำให้ดี มี 2 ค่า และถูกต้องทั้งคู่:**
>
> - **ตอน dev ในเครื่อง = 4001** — ค่า default ในโค้ด, `.env.example` และ fallback ฝั่ง frontend
>   (`http://localhost:4001`) ตรงกันหมด
> - **บนเซิร์ฟเวอร์จริง = 4011** — `.env` ตั้ง `PORT=4011` เพราะ **nginx proxy `/api` ไปที่ 4011**
>   ห้ามแก้ค่านี้เป็นอย่างอื่นถ้าไม่ได้แก้ config ของ nginx ด้วย
>
> ฝั่ง frontend บน production เรียกผ่าน `https://fangfangshop.develyst.online/api` (nginx) ไม่ได้ยิงพอร์ตตรง
> จึงไม่ต้องรู้เลขพอร์ต

### วิธีรัน

```bash
bun install
bun run db:setup   # สร้างตาราง + บัญชีเริ่มต้น + seed สินค้า (รันครั้งแรกครั้งเดียว)
bun run dev        # เปิด API ที่ http://localhost:4001 (watch mode)
```

บัญชีเริ่มต้น (รหัสผ่าน `1234` ทุกบัญชี — ควรเปลี่ยนด้วย `POST /auth/change-password`):

| username | ชื่อที่แสดง |
|----------|-----------|
| `owner`  | เจ้าของร้าน |
| `staff`  | พนักงานขาย |
| `wi`     | วิ |
| `toey`   | เตย |
| `fang`   | ฟ่าง |
| `ree`    | รี |

> `bun run db:init` รันซ้ำได้เรื่อยๆ (idempotent) — เพิ่มตาราง/คอลัมน์/บัญชีที่ยังไม่มีเท่านั้น ไม่ลบของเดิม

---

## 3. Data model ที่ frontend ใช้อยู่ (อ้างอิงเป็น contract)

ฝั่ง frontend นิยาม `Product` ประมาณนี้ (ดูของจริงใน `../fangfangshop/app/page.tsx`):

```ts
type Product = {
  id: number;
  name: string;        // ชื่อสินค้า (ภาษาไทย)
  category: string;    // หมวดหมู่
  stock: number;       // จำนวนคงเหลือ
  minStock: number;    // เกณฑ์ "ใกล้หมด"
  unit: string;        // หน่วย เช่น ขวด / ซอง / กระป๋อง
  shelf: string;       // ตำแหน่งชั้นวาง
  price: number;       // ราคา (0 = ยังไม่ตั้งราคา)
  updatedBy: string;   // ใครอัปเดตล่าสุด
  sizeLabel?: string;
  imageUrl?: string;
  isPlaceholder?: boolean;
};
```

สถานะสต็อกคำนวณจาก `stock` เทียบ `minStock`: `พร้อมขาย` / `ใกล้หมด` / `หมด`

> หมายเหตุ: `shelf` อยู่ในสเปกเดิมแต่ frontend/DB ปัจจุบัน **ไม่ได้ใช้** — จึงไม่มีในตาราง

Endpoint จริงที่มีตอนนี้:

- `GET   /products` — รายการสินค้าทั้งหมด (สำหรับทุกคน)
- `POST  /auth/login` — ล็อกอิน (username/password) → `{ token, username, displayName, avatarUrl? }`
- `POST  /auth/logout` — ลบ session (ส่ง `Authorization: Bearer <token>`)
- `GET   /auth/me` — ใครล็อกอินอยู่ + ชื่อ/รูปล่าสุด (ต้องล็อกอิน) — ไว้เช็คว่า token เก่ายังใช้ได้
- `PATCH /auth/me` — แก้ชื่อที่แสดง/รูปประจำตัวของตัวเอง (ต้องล็อกอิน)
- `POST  /auth/change-password` — เปลี่ยนรหัสผ่านตัวเอง (ต้องล็อกอิน) — ล้าง session ทั้งหมดของคนนั้น
- `GET   /users` — รายชื่อคนในบ้าน (`username`, `displayName`, `avatarUrl`) ไว้ทำหน้าจอเลือกคนตอนล็อกอิน
- `POST  /products` — เพิ่มสินค้า (ต้องล็อกอิน) — id สร้างอัตโนมัติจาก sequence
- `PATCH /products/:id` — แก้สต็อก/ราคา/ข้อมูล (ต้องล็อกอิน) — ส่งเฉพาะ field ที่จะแก้
  (`imageUrl: null` = ลบรูปที่ตั้งเอง กลับไปใช้รูปเริ่มต้นของ frontend)
- `POST   /images` — อัปโหลดรูป (ต้องล็อกอิน) → `{ id, url, mime, byteSize }`
- `GET    /images` — รายการรูปที่อัปไว้ (ต้องล็อกอิน) — เมทาดาทาอย่างเดียว
- `GET    /images/:id` — ดูรูป (ทุกคน)
- `DELETE /images/:id` — ลบรูป (ต้องล็อกอิน) — ตอบ 409 ถ้ายังมีสินค้า/คนใช้รูปนี้อยู่

### คลังรูปภาพ (images)

ก่อนหน้านี้ frontend เก็บรูปที่ผู้ใช้อัปเองไว้ใน IndexedDB ของเบราว์เซอร์ — เห็นแค่เครื่องตัวเอง
ตอนนี้ backend มีที่เก็บกลางแล้ว รูปอยู่ในตาราง `images` (BYTEA) ทุกเครื่องจึงเห็นรูปเดียวกัน

- **id ของรูป = sha256 ของไฟล์** → อัปรูปเดิมซ้ำได้ url เดิม ไม่กินที่เพิ่ม
  และเสิร์ฟด้วย `Cache-Control: immutable` + `ETag` ได้อย่างปลอดภัย
- อัปได้ 2 แบบ: `multipart/form-data` (field ชื่อ `file`) หรือ JSON `{ dataUrl }` / `{ base64, mime }`
- ชนิดที่รับ: png / jpeg / webp / gif / avif — ขนาดสูงสุด **2 MB**
  (frontend ย่อรูปเหลือ ~200 KB ก่อนส่งอยู่แล้ว)
- `?kind=avatar` ใช้บอกว่าเป็นรูปประจำตัว (ค่าเริ่มต้นคือ `product`) — มีผลแค่ป้ายกำกับ
- นำ `url` ที่ได้ไปใส่ `imageUrl` ของสินค้า หรือ `avatarUrl` ของคน ผ่าน `PATCH /products/:id` / `PATCH /auth/me`

ตัวอย่าง:

```bash
curl -X POST http://localhost:4001/images \
  -H "Authorization: Bearer $TOKEN" -F "file=@rup.png;type=image/png"
# → {"id":"<sha256>","url":"/images/<sha256>.png","mime":"image/png","byteSize":12345}
```

### บัญชีผู้ใช้

`users` มีคอลัมน์ `avatar_url` เก็บได้ทั้ง preset ของ frontend (เช่น `preset:cat-1`)
และรูปที่อัปเอง (`/images/<sha256>.png`) — backend ไม่ตีความค่านี้ frontend ตัดสินใจเอง

ชื่อ/รูปที่ API คืนกลับ **อ่านจากตาราง `users` เสมอ** (JOIN กับ `sessions`) เปลี่ยนแล้วเห็นผลทันที
ไม่ต้องล็อกอินใหม่ และ `displayName` การันตีว่าไม่เป็น `null`/`undefined` (ถ้าว่างใช้ `username` แทน)

---

## 4. แนวทางสำหรับ AI agent

- ยึดความ **เรียบง่าย** เป็นหลัก — โปรเจกต์นี้เป็นร้านค้าเล็กๆ ไม่ต้อง over-engineer
- คงชื่อ field ให้ตรงกับ `Product` ฝั่ง frontend เพื่อไม่ต้องแปลงข้อมูลไปมา
- ข้อความ/ข้อมูลที่เกี่ยวกับสินค้าเป็นภาษาไทย
- เมื่อเริ่มเขียนโค้ดจริง ให้ **อัปเดตไฟล์นี้** ให้สะท้อน stack, วิธีรัน, และ endpoint จริง

---

## 5. Repo ที่เกี่ยวข้อง

| Repo | หน้าที่ |
|------|---------|
| `fangfangshop` | Frontend (Next.js + Ant Design) — mobile web app |
| `fangfangshop-back` | Backend / API (repo นี้) |
