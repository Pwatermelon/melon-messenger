import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { join } from "path";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chats";
import { uploadRoutes, UPLOAD_DIR } from "./routes/upload";
import { wsHandlers, setWSServer, setupRedisSubscriber } from "./ws";
import { initScylla } from "./services/scylla";

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  try {
    await initScylla();
  } catch (e) {
    console.warn("ScyllaDB init failed (optional for dev):", e);
  }

  const app = new Elysia()
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

  app.listen(PORT);
  const server = (app as { server?: { publish: (topic: string, data: string) => number } }).server;
  if (server) {
    setWSServer(server);
    setupRedisSubscriber(server);
  }
  console.log(`API + WS on http://localhost:${PORT}`);
}

main();
