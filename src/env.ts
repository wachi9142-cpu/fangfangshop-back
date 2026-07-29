// รวมค่าคอนฟิกจาก environment ไว้ที่เดียว (มีค่า default ให้รันได้ทันทีในโหมด dev)
export const env = {
  port: Number(process.env.PORT ?? 4000),
  authSecret: process.env.AUTH_SECRET ?? "dev-change-me-to-a-long-random-string",
  authTokenTtl: Number(process.env.AUTH_TOKEN_TTL ?? 60 * 60 * 24 * 7), // 7 วัน
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
};
