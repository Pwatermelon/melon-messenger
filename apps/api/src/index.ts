import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { join } from "path";
import { sql } from "drizzle-orm";
import { paymentRoutes } from "./routes/payments";
import { pushRoutes } from "./routes/push";
import { healthRoutes, incrementRequestCount } from "./routes/health";
import { rateLimitPlugin } from "./middleware/rateLimit";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { chatRoutes } from "./routes/chats";
import { uploadRoutes, UPLOAD_DIR } from "./routes/upload";
import { wsHandlers, setWSServer, setupRedisSubscriber } from "./ws";
import { initScylla } from "./services/scylla";
import { db } from "./db";
import { validateProductionEnv } from "./lib/envCheck";
import { e2eRoutes, isE2eEnabled } from "./routes/e2e";

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  validateProductionEnv();
  try {
    await initScylla();
  } catch (e) {
    console.warn("ScyllaDB init failed (optional for dev):", e);
  }
  try {
    await db.execute(sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_url text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS yandex_id varchar(64)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS yandex_login varchar(64)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier varchar(20) NOT NULL DEFAULT 'free'`);
    await db.execute(sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_approved boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photos text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday varchar(10)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday_visible boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_history text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        yookassa_payment_id varchar(64),
        amount varchar(20) NOT NULL,
        currency varchar(3) NOT NULL DEFAULT 'RUB',
        status varchar(32) NOT NULL DEFAULT 'pending',
        plan varchar(32) NOT NULL DEFAULT 'platinum',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint text NOT NULL,
        p256dh text NOT NULL,
        auth text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  } catch (e) {
    console.warn("Schema migration (optional):", e);
  }

  if (!process.env.MESSAGE_AT_REST_KEY) {
    console.warn("[Security] MESSAGE_AT_REST_KEY не задан — сообщения хранятся без шифрования at-rest. Задайте ключ в production.");
  }

  const app = new Elysia({
    websocket: { perMessageDeflate: false },
  })
    .onRequest(() => {
      incrementRequestCount();
    })
    .onError(({ code, error, set }) => {
      if (error?.message === "Unauthorized") {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      console.error("[API error]", code, error);
      set.status = set.status ?? 500;
      return { error: code === "VALIDATION" ? (error?.message ?? "Validation error") : "Internal server error" };
    })
    .use(cors({ origin: true, credentials: true }))
    .use(healthRoutes)
    .use(rateLimitPlugin({ prefix: "global", windowSec: 60, max: 300 }))
    .get("/uploads/:filename", async ({ params, set }) => {
      const filename = params.filename.replace(/\.\./g, "").replace(/\//g, "");
      if (!filename) {
        set.status = 400;
        return "Bad request";
      }
      const path = join(UPLOAD_DIR, filename);
      try {
        const file = Bun.file(path);
        if (!(await file.exists())) {
          set.status = 404;
          return "Not found";
        }
        return new Response(file, { headers: { "Cache-Control": "public, max-age=86400" } });
      } catch {
        set.status = 404;
        return "Not found";
      }
    })
    .use(rateLimitPlugin({ prefix: "auth", windowSec: 60, max: 30 }))
    .use(authRoutes)
    .use(adminRoutes)
    .use(paymentRoutes)
    .use(pushRoutes)
    .use(isE2eEnabled() ? e2eRoutes : new Elysia())
    .use(chatRoutes)
    .use(uploadRoutes)
    .ws("/ws", wsHandlers);

  app.listen({ port: PORT, hostname: "0.0.0.0" });
  const server = (app as { server?: { publish: (topic: string, data: string) => number } }).server;
  if (server) {
    setWSServer(server);
    setupRedisSubscriber(server);
  }
  console.log(`API + WS on http://localhost:${PORT}`);
  if (isE2eEnabled()) console.log("[E2E] Test routes enabled at /e2e/*");
}

main();
