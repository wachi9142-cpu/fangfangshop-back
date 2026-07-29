# CLAUDE.md

Claude Code: อ่าน **[AGENTS.md](./AGENTS.md)** เป็นเอกสารหลักของ repo นี้

สรุปสั้น: นี่คือ backend/API ของ Fang Fang Shop (เว็บแอปมือถือแสดงสินค้า/ราคา/สต็อกของร้านของชำ)
Stack: **Node + Hono + Prisma + SQLite** (รันด้วย `tsx`) — API ใช้งานได้แล้ว
มี CRUD สินค้า + ล็อกอินพนักงานแบบง่าย (token HMAC) ยึด `type Product` จากฝั่ง frontend
(`../fangfangshop`) เป็น contract ของข้อมูล

รัน: `npm install` → `cp .env.example .env` → `npm run db:migrate` → `npm run dev` (พอร์ต 4000)
