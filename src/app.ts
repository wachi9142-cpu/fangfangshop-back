import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env";
import { authRoutes } from "./routes/auth";
import { productRoutes } from "./routes/products";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: env.corsOrigin,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"]
    })
  );

  // health check
  app.get("/", (c) => c.json({ ok: true, service: "fangfangshop-back", version: "0.1.0" }));

  app.route("/auth", authRoutes);
  app.route("/products", productRoutes);

  // 404 + error กลาง
  app.notFound((c) => c.json({ error: "ไม่พบเส้นทางนี้" }, 404));
  app.onError((err, c) => {
    console.error("[error]", err);
    return c.json({ error: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" }, 500);
  });

  return app;
}
