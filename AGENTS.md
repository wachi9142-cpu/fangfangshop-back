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

⚠️ **repo นี้ยังว่างเปล่า** — มีแค่ README เดิมและไฟล์เอกสารนี้ ยังไม่มีโค้ดใดๆ

ฝั่ง frontend ตอนนี้ยัง **ไม่ได้เชื่อม backend** — ข้อมูลสินค้าถูก hardcode ไว้ใน
`app/page.tsx` และ persist ผ่าน `localStorage` ของเบราว์เซอร์เท่านั้น

ดังนั้นงานของ repo นี้คือ **สร้าง backend ขึ้นมาใหม่ตั้งแต่ต้น** เพื่อ:

1. ย้ายข้อมูลสินค้าจาก hardcode/localStorage มาเป็นฐานข้อมูลจริง + API
2. เปิด API ให้ frontend ดึงรายการสินค้า/ราคา/สต็อก
3. เปิด API ให้พนักงานที่ล็อกอินแล้วอัปเดตสต็อก/ราคา/สินค้า
4. ระบบล็อกอิน username/password แบบง่าย

> ยังไม่ได้เลือก tech stack ของ backend — เมื่อจะเริ่ม ให้ถามเจ้าของโปรเจกต์
> หรือเสนอทางเลือกที่เข้ากับ frontend (Next.js/TypeScript) เช่น Next.js API routes,
> Node/Express, หรือ backend อื่นที่ทีมถนัด แล้วบันทึกการตัดสินใจไว้ในไฟล์นี้

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

API ที่ backend ควรมี (ข้อเสนอเริ่มต้น):

- `GET  /products` — รายการสินค้าทั้งหมด (สำหรับทุกคน)
- `POST /auth/login` — ล็อกอินพนักงาน (username/password) → คืน token/session ง่ายๆ
- `POST /products` — เพิ่มสินค้า (ต้องล็อกอิน)
- `PATCH /products/:id` — แก้สต็อก/ราคา/ข้อมูลสินค้า (ต้องล็อกอิน)

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
