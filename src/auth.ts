import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { env } from "./env";

// บัญชีพนักงาน/เจ้าของร้านแบบง่าย (ตรงกับฝั่ง frontend)
// ⚠️ ตั้งใจให้เรียบง่าย — production จริงควรย้ายไปเก็บใน DB + hash รหัสผ่าน
export type StaffAccount = { username: string; password: string; displayName: string };

export const staffAccounts: StaffAccount[] = [
  { username: "owner", password: "1234", displayName: "เจ้าของร้าน" },
  { username: "staff", password: "1234", displayName: "พนักงานขาย" }
];

export type AuthUser = { username: string; displayName: string };
type TokenPayload = AuthUser & { exp: number };

const base64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const sign = (data: string) => base64url(createHmac("sha256", env.authSecret).update(data).digest());

/** ออก token แบบ stateless: base64url(payload).signature */
export function createToken(user: AuthUser): string {
  const payload: TokenPayload = {
    username: user.username,
    displayName: user.displayName,
    exp: Math.floor(Date.now() / 1000) + env.authTokenTtl
  };
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${sign(body)}`;
}

/** ตรวจสอบ token — คืน user ถ้าใช้ได้, คืน null ถ้าไม่ถูกต้อง/หมดอายุ */
export function verifyToken(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64").toString("utf8")) as TokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { username: payload.username, displayName: payload.displayName };
  } catch {
    return null;
  }
}

/** ตรวจ username/password กับบัญชีที่มี */
export function findAccount(username: string, password: string): StaffAccount | null {
  return (
    staffAccounts.find((acc) => acc.username === username && acc.password === password) ?? null
  );
}

// ประเภทตัวแปรที่แนบไว้ใน context หลังผ่าน middleware
export type AuthVariables = { user: AuthUser };

/** middleware: บังคับให้ล็อกอิน (อ่าน token จาก Authorization: Bearer <token>) */
export async function requireAuth(c: Context<{ Variables: AuthVariables }>, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const user = verifyToken(token);
  if (!user) {
    return c.json({ error: "ต้องล็อกอินก่อน (token ไม่ถูกต้องหรือหมดอายุ)" }, 401);
  }
  c.set("user", user);
  await next();
}
