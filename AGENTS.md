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
| `src/db-init.ts` | สร้างตาราง products/users/sessions + บัญชีพนักงานเริ่มต้น |
| `src/seed.ts`    | นำเข้า catalog จาก `seed-products.json` (upsert ตาม id) |
| `.env`           | `DATABASE_URL`, `PORT`, `CORS_ORIGIN` (อยู่ใน .gitignore) |

### วิธีรัน

```bash
bun install
bun run db:setup   # สร้างตาราง + บัญชีเริ่มต้น + seed สินค้า (รันครั้งแรกครั้งเดียว)
bun run dev        # เปิด API ที่ http://localhost:4001 (watch mode)
```

บัญชีทดสอบ: `owner` / `1234` (เจ้าของร้าน), `staff` / `1234` (พนักงานขาย)

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
- `POST  /auth/login` — ล็อกอิน (username/password) → `{ token, username, displayName }`
- `POST  /auth/logout` — ลบ session (ส่ง `Authorization: Bearer <token>`)
- `POST  /products` — เพิ่มสินค้า (ต้องล็อกอิน) — id สร้างอัตโนมัติจาก sequence
- `PATCH /products/:id` — แก้สต็อก/ราคา/ข้อมูล (ต้องล็อกอิน) — ส่งเฉพาะ field ที่จะแก้

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
| `fangfangshop-back` | Backend / API (repo นี้ — ยังไม่เริ่มพัฒนา) |
