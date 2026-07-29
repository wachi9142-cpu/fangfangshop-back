import { Hono } from "hono";
import { createToken, findAccount, verifyToken } from "../auth";

export const authRoutes = new Hono();

// POST /auth/login — ล็อกอินพนักงาน คืน token + ชื่อที่แสดง
authRoutes.post("/login", async (c) => {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, 400);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return c.json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, 400);
  }

  const account = findAccount(username, password);
  if (!account) {
    return c.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  const user = { username: account.username, displayName: account.displayName };
  return c.json({ token: createToken(user), user });
});

// GET /auth/me — ตรวจว่า token ยังใช้ได้ไหม (ให้ frontend เช็คสถานะล็อกอิน)
authRoutes.get("/me", (c) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const user = verifyToken(token);
  if (!user) return c.json({ error: "token ไม่ถูกต้องหรือหมดอายุ" }, 401);
  return c.json({ user });
});
