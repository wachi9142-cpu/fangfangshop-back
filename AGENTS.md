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

## 2. สถานะปัจจุบัน (Current state — สำคัญมาก)

**API ใช้งานได้จริงแล้ว** — รันได้, migrate + seed แล้ว, ทดสอบทุก endpoint ผ่าน

สิ่งที่ **มีแล้ว**:

- ✅ Hono app + CORS + logger + health check (`src/app.ts`)
- ✅ Prisma + SQLite, schema `Product` ตรงกับ contract ฝั่ง frontend (`prisma/schema.prisma`)
- ✅ seed ข้อมูลตัวอย่าง 21 รายการ (`prisma/seed.ts`)
- ✅ ล็อกอินแบบง่าย + token HMAC-SHA256 แบบ stateless (`src/auth.ts`)
- ✅ CRUD สินค้า + validate + คำนวณ `status` ให้ (`src/routes/products.ts`)

สิ่งที่ **ยังไม่มี**:

- ❌ catalog เต็ม (300+ รายการ) — ตอนนี้ seed แค่ 21 รายการตัวแทน
  ของจริงยัง hardcode อยู่ใน `../fangfangshop/app/page.tsx`
- ❌ บัญชีพนักงานเก็บใน DB + hash รหัสผ่าน (ตอนนี้ hardcode ใน `src/auth.ts` ตามที่ตั้งใจให้ง่าย)
- ❌ อัปโหลดรูปจริง (ตอนนี้เก็บเป็น URL/data URL string)

---

## 2.1 Tech stack & วิธีรัน

**Node + Hono + Prisma + SQLite** (TypeScript ล้วน ไม่ต้องตั้ง DB server แยก)

> เดิมเขียนไว้สำหรับ Bun แต่เครื่อง dev ไม่มี Bun จึงย้ายมารันบน **Node ผ่าน `tsx`**
> และใช้ `@hono/node-server` — `src/index.ts` ยัง `export default { port, fetch }` ไว้
> เผื่อรันด้วย Bun ได้เหมือนเดิม

```bash
npm install
cp .env.example .env
npm run db:migrate   # สร้างตาราง + seed อัตโนมัติ
npm run dev          # http://localhost:4000 (watch mode)
```

> ⚠️ npm 11 บล็อก install script โดย default — ถ้า prisma/esbuild ไม่ทำงาน
> ให้รัน `npm approve-scripts @prisma/client prisma @prisma/engines esbuild` แล้ว install ใหม่

โครงสร้างไฟล์:

```
src/
├── index.ts          ← entry point (serve ด้วย @hono/node-server)
├── app.ts            ← ประกอบ Hono app + middleware + route
├── env.ts            ← รวมค่า config จาก environment
├── db.ts             ← Prisma client (singleton)
├── auth.ts           ← บัญชีพนักงาน, สร้าง/ตรวจ token, middleware requireAuth
└── routes/
    ├── auth.ts       ← POST /auth/login, GET /auth/me
    └── products.ts   ← CRUD /products
prisma/
├── schema.prisma
└── seed.ts
```

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

> หมายเหตุ: schema ฝั่ง backend **ไม่มี** `shelf` และ `isPlaceholder`
> (`shelf` ไม่ได้ใช้จริงในหน้าเว็บ, `isPlaceholder` เป็นเรื่องของ UI ล้วนๆ)

API ที่มีจริงตอนนี้:

| Method | Path | สิทธิ์ | หน้าที่ |
|--------|------|--------|---------|
| GET | `/` | ทุกคน | health check |
| GET | `/products` | ทุกคน | รายการสินค้า (`?category=` `?q=` `?status=`) |
| GET | `/products/:id` | ทุกคน | สินค้ารายตัว |
| POST | `/auth/login` | ทุกคน | ล็อกอิน → `{ token, user }` |
| GET | `/auth/me` | มี token | ตรวจสถานะล็อกอิน |
| POST | `/products` | ต้องล็อกอิน | เพิ่มสินค้า |
| PATCH | `/products/:id` | ต้องล็อกอิน | แก้สต็อก/ราคา/ข้อมูล |
| DELETE | `/products/:id` | ต้องล็อกอิน | ลบสินค้า |

- ทุก response ของสินค้าจะมี field `status` ที่คำนวณมาให้แล้ว (frontend ไม่ต้องคำนวณเอง)
- บัญชีทดสอบ: `owner` / `1234`, `staff` / `1234`
- ส่ง token ผ่าน header `Authorization: Bearer <token>`

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
| `fangfangshop-back` | Backend / API (repo นี้ — Node + Hono + Prisma + SQLite) |
