import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { env } from "./env";

const app = createApp();

serve({ port: env.port, fetch: app.fetch }, () => {
  console.log(`🐱 fangfangshop-back พร้อมทำงานที่ http://localhost:${env.port}`);
});

// เผื่อรันด้วย Bun (`bun run src/index.ts`) — Bun อ่าน default export นี้แทน
export default {
  port: env.port,
  fetch: app.fetch
};
