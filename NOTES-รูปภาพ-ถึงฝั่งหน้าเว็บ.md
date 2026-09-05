# ถึงฝั่งหน้าเว็บ (frontend) — backend ทำที่เก็บรูปกลางให้แล้ว

สรุปสิ่งที่ backend เพิ่มให้ ตามที่แจ้งมาใน `NOTES-ระบบรูปภาพ.md` 3 เรื่อง

---

## 1. รูปแชร์กันได้จริงแล้ว (ไม่ต้องพึ่ง IndexedDB)

รูปเก็บกลางที่ Postgres → อัปจากเครื่องไหน เครื่องอื่นก็เห็น

**อัปโหลด** (ต้องล็อกอิน) — ได้ทั้งสองแบบ:

```ts
// แบบที่ 1: ไฟล์ตรงๆ (แนะนำ — เบากว่า base64 ~25%)
const form = new FormData();
form.append("file", fileAfterResize);            // Blob/File ที่ย่อแล้ว
const res = await fetch(`${API_BASE}/images?kind=product`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` }, // อย่าใส่ Content-Type เอง
  body: form
});
const { url } = await res.json();   // "/images/<sha256>.png"

// แบบที่ 2: data URL (ถ้าโค้ดย่อรูปเดิมได้ dataURL มาอยู่แล้ว ส่งตรงๆ ได้เลย)
await fetch(`${API_BASE}/images`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ dataUrl })
});
```

- ชนิดที่รับ: png / jpeg / webp / gif / avif — **ไม่เกิน 2 MB** (ที่ย่อเหลือ ~200 KB นี่สบายมาก)
- `?kind=avatar` ใส่ตอนอัปรูปประจำตัว (ไม่ใส่ = `product`) — เป็นแค่ป้ายกำกับ
- **อัปรูปเดิมซ้ำได้ url เดิม** เพราะ id ของรูปคือ sha256 ของไฟล์ → ไม่กินที่ซ้ำ
  และเสิร์ฟด้วย `Cache-Control: immutable` + `ETag` เบราว์เซอร์ cache ยาวได้เลย

**เอาไปผูกกับสินค้า / คน:**

```ts
await updateProduct(id, { imageUrl: url });               // รูปสินค้า
await fetch(`${API_BASE}/auth/me`, { method: "PATCH", ... body: { avatarUrl: url } }); // รูปประจำตัว
```

**ล้างรูปที่ตั้งเอง** (กลับไปใช้รูป default ในโค้ด): ส่ง `imageUrl: null` / `avatarUrl: null`

> ⚠️ `url` ที่คืนมาเป็น path (`/images/...`) ไม่ใช่ URL เต็ม — เวลาเอาไปใส่ `<img src>`
> ต้องต่อ `API_BASE` เอง เช่น `` `${API_BASE}${product.imageUrl}` `` เฉพาะกรณีที่ขึ้นต้นด้วย `/images/`
> (รูป default ที่อยู่ใน `public/product-images/...` ยังใช้ path เดิมของ Next ตามปกติ)

**ย้ายของเก่าจาก IndexedDB:** วนอ่านรูปที่ผู้ใช้เคยอัปไว้ในเครื่อง → `POST /images` → `PATCH /products/:id`
ทำครั้งเดียวตอนล็อกอินก็พอ (อัปซ้ำไม่พัง เพราะ sha256 ซ้ำก็ได้ url เดิม)

---

## 2. ชื่อคนในบ้าน — เพิ่มในระบบล็อกอินแล้ว

| username | ชื่อที่แสดง |
|----------|-----------|
| `wi`   | วิ |
| `toey` | เตย |
| `fang` | ฟ่าง |
| `ree`  | รี |

(รหัสผ่านเริ่มต้น `1234` ทุกคน เหมือน `owner` / `staff` ที่มีอยู่เดิม — เปลี่ยนได้ที่
`POST /auth/change-password` โดยส่ง `{ currentPassword, newPassword }`)

ของใหม่ที่ใช้ทำ UI ได้:

- `GET /users` — ไม่ต้องล็อกอิน คืน `[{ username, displayName, avatarUrl? }]`
  เอาไปทำหน้าจอ "เลือกว่าเป็นใคร" ตอนล็อกอินได้เลย
- `GET /auth/me` — เช็คว่า token ที่เก็บใน localStorage ยังใช้ได้ไหม + ได้ชื่อ/รูปล่าสุด
- `PATCH /auth/me` — `{ displayName?, avatarUrl? }` เปลี่ยนชื่อ/รูปตัวเอง เห็นผลทันทีทุกเครื่อง
  ไม่ต้องล็อกอินใหม่ (API อ่านชื่อจากตาราง `users` เสมอ)

---

## 3. บั๊ก 2 ตัวที่แจ้งมา — ฝั่ง backend จัดการแล้ว

**ชื่อขึ้น `undefined`:** `displayName` การันตีว่าไม่เป็น `null`/`undefined` แล้ว
(ถ้าค่าว่างจะใช้ `username` แทน) ทั้งใน `/auth/login`, `/auth/me`, `/users`
และ `/auth/login` คืน `avatarUrl` มาให้ด้วยแล้ว

**พอร์ตไม่ตรงกัน:** สรุปให้ชัด — มี 2 ค่า และถูกทั้งคู่ ไม่ใช่บั๊ก

- **dev ในเครื่อง = 4001** — ค่า default ในโค้ดแก้เป็น 4001 แล้ว (เดิมเป็น 3001 ซึ่งไม่ตรงกับ
  ที่เอกสารเขียนและไม่ตรงกับ fallback ฝั่งหน้าเว็บ — ตรงนี้แหละที่เพี้ยน) ตอนนี้ตรงกันหมดแล้ว
- **บนเซิร์ฟเวอร์ = 4011** — ตั้งไว้ใน `.env` เพราะ **nginx proxy `/api` ไปที่ 4011**
  ปล่อยไว้แบบนี้ ห้ามแก้ถ้าไม่ได้แก้ nginx ด้วย

หน้าเว็บบน production ยิงผ่าน `https://fangfangshop.develyst.online/api` (nginx) อยู่แล้ว
เลยไม่ต้องรู้เลขพอร์ตเลยทั้งระบบ

---

## ต้องทำอะไรบนเซิร์ฟเวอร์บ้าง

`bun run db:init` (รันซ้ำได้ ไม่ลบของเดิม) — สร้างตาราง `images`, เพิ่มคอลัมน์ `users.avatar_url`,
เพิ่มบัญชี วิ/เตย/ฟ่าง/รี — **รันกับ DB จริงไปแล้ว** ตอนทดสอบ เหลือแค่ deploy โค้ดใหม่

รายละเอียด endpoint ทั้งหมดอยู่ใน [AGENTS.md](./AGENTS.md) และ [README.md](./README.md)
