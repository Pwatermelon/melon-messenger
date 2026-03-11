import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { join } from "path";
import { sql } from "drizzle-orm";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chats";
import { uploadRoutes, UPLOAD_DIR } from "./routes/upload";
import { wsHandlers, setWSServer, setupRedisSubscriber } from "./ws";
import { initScylla } from "./services/scylla";
import { db } from "./db";

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  try {
    await initScylla();
  } catch (e) {
    console.warn("ScyllaDB init failed (optional for dev):", e);
  }
  try {
    await db.execute(sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_url text`);
  } catch (e) {
    console.warn("Ensure chats.avatar_url column (optional):", e);
  }

  const app = new Elysia({
    websocket: { perMessageDeflate: false },
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
    .use(authRoutes)
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
}

main();
