# CLAUDE.md

Claude Code: อ่าน **[AGENTS.md](./AGENTS.md)** เป็นเอกสารหลักของ repo นี้

สรุปสั้น: นี่คือ backend/API ของ Fang Fang Shop (เว็บแอปมือถือแสดงสินค้า/ราคา/สต็อกของร้านของชำ)
สร้างด้วย **Bun + Hono + PostgreSQL** เชื่อมกับ frontend (`../fangfangshop`) เรียบร้อยแล้ว
มี catalog 414 รายการใน DB, ล็อกอินพนักงานแบบ token ง่ายๆ ยึด `type Product` เป็น contract ของข้อมูล
วิธีรัน/endpoint/สถาปัตยกรรม ดูใน AGENTS.md
