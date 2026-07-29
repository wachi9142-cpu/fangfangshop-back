# fangfangshop-back

Backend / API ของ **Fang Fang Shop** — เว็บแอปมือถือที่แสดงรายการสินค้า ราคา
และจำนวนสต็อกของร้านของชำ

- ให้บริการข้อมูลสินค้า (catalog), ราคา, และสต็อกแก่ frontend
- รองรับการอัปเดตสต็อก/ราคาโดยพนักงานที่ล็อกอินแล้ว
- ระบบล็อกอิน username/password แบบง่าย (แยกสิทธิ์ดู vs แก้ไข)

> รายละเอียด, data model contract, และ endpoint อยู่ใน **[AGENTS.md](./AGENTS.md)**

Frontend อยู่ที่ repo `../fangfangshop` (Next.js + Ant Design)

## Tech stack

**Node + Hono + Prisma + SQLite** — เรียบง่าย TypeScript ล้วน ไม่ต้องตั้ง DB server แยก
(รัน TypeScript ตรงๆ ด้วย `tsx` ไม่ต้อง build)

## เริ่มใช้งาน (Quick start)

```bash
npm install                 # ติดตั้ง dependencies
cp .env.example .env        # ตั้งค่า env (มีค่า default ให้รันได้ทันที)
npm run db:migrate          # สร้างตารางใน SQLite + seed ข้อมูลตัวอย่างอัตโนมัติ
npm run dev                 # รัน API ที่ http://localhost:4000 (watch mode)
```

> ถ้า npm เตือนว่าบล็อก install script (npm 11 ขึ้นไป) ให้รัน
> `npm approve-scripts @prisma/client prisma @prisma/engines esbuild` แล้ว `npm install` ใหม่
>
> ถ้าใช้ Bun ก็รันได้เหมือนกัน (`bun run src/index.ts`) — `src/index.ts` export default ไว้ให้แล้ว

## API endpoints

| Method | Path | สิทธิ์ | หน้าที่ |
|--------|------|--------|---------|
| GET | `/` | ทุกคน | health check |
| GET | `/products` | ทุกคน | รายการสินค้า (รองรับ `?category=` `?q=` `?status=`) |
| GET | `/products/:id` | ทุกคน | สินค้ารายตัว |
| POST | `/auth/login` | ทุกคน | ล็อกอิน → คืน `{ token, user }` |
| GET | `/auth/me` | มี token | ตรวจสถานะล็อกอิน |
| POST | `/products` | ต้องล็อกอิน | เพิ่มสินค้า |
| PATCH | `/products/:id` | ต้องล็อกอิน | แก้สต็อก/ราคา/ข้อมูล |
| DELETE | `/products/:id` | ต้องล็อกอิน | ลบสินค้า |

บัญชีทดสอบ: `owner` / `1234`, `staff` / `1234`
ส่ง token ผ่าน header: `Authorization: Bearer <token>`
