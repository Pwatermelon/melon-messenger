import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { sql } from "drizzle-orm";
import { coinRoutes } from "./routes/coins";
import { pushRoutes } from "./routes/push";
import { healthRoutes, incrementRequestCount } from "./routes/health";
import { metricsRoutes } from "./routes/metrics";
import { rateLimitPlugin } from "./middleware/rateLimit";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { adminObservabilityRoutes } from "./routes/adminObservability";
import { chatRoutes } from "./routes/chats";
import { chatFolderRoutes } from "./routes/chatFolders";
import { contactRoutes } from "./routes/contacts";
import { blockRoutes } from "./routes/blocks";
import { stickerPackRoutes } from "./routes/stickerPacks";
import { uploadRoutes } from "./routes/upload";
import { mediaRoutes } from "./routes/media";
import { wsHandlers, setupRedisSubscriber, setWSServer } from "./ws";
import { initScylla } from "./services/scylla";
import { startMetricsRefresh, trackHttpRequest } from "./services/prometheus";
import { db } from "./db";
import { validateProductionEnv } from "./lib/envCheck";
import { e2eRoutes, isE2eEnabled } from "./routes/e2e";
import { reportsRoutes, adminReportsRoutes } from "./routes/reports";
import { legalRoutes, authLegalRoutes, adminLegalRoutes } from "./routes/legal";
import { backfillMediaDimensions } from "./db/backfillMediaDimensions";

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
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS coin_balance integer NOT NULL DEFAULT 0`);
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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_contacts (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, contact_user_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS media_files (
        filename varchar(255) PRIMARY KEY,
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        visibility varchar(16) NOT NULL DEFAULT 'chat',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS media_chat_grants (
        filename varchar(255) NOT NULL REFERENCES media_files(filename) ON DELETE CASCADE,
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (filename, chat_id)
      )
    `);
    await db.execute(sql`ALTER TABLE media_files ADD COLUMN IF NOT EXISTS original_name varchar(255)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_read_cursors (
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_message_id text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (chat_id, user_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_unread_counts (
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        unread_count int NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (chat_id, user_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS message_reactions (
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        message_id text NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (message_id, user_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS message_reactions_chat_idx ON message_reactions (chat_id)
    `);
    await db.execute(sql`ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sticker_packs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title varchar(100) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        pack_id uuid NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
        emoji varchar(32) NOT NULL,
        image_url text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_sticker_packs (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pack_id uuid NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
        added_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, pack_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS stickers_pack_idx ON stickers (pack_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_blocks (
        blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (blocker_id, blocked_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_folders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name varchar(100) NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        kind varchar(20) NOT NULL DEFAULT 'custom',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_folder_items (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        folder_id uuid NOT NULL REFERENCES chat_folders(id) ON DELETE CASCADE,
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, folder_id, chat_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS chat_folders_user_idx ON chat_folders (user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS chat_folder_items_user_chat_idx ON chat_folder_items (user_id, chat_id)
    `);
    await db.execute(sql`
      DELETE FROM chat_folders WHERE kind = 'favorites'
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category varchar(32) NOT NULL DEFAULT 'other',
        message text NOT NULL,
        page_url text,
        screenshot_url text,
        status varchar(16) NOT NULL DEFAULT 'open',
        admin_note text,
        resolved_at timestamptz,
        resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports (status, created_at DESC)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_legal_acceptances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        batch_id uuid NOT NULL,
        document_type varchar(32) NOT NULL,
        document_version varchar(16) NOT NULL,
        ip_address varchar(64),
        user_agent varchar(512),
        accepted_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_legal_acceptances_user_idx ON user_legal_acceptances (user_id, accepted_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_legal_acceptances_batch_idx ON user_legal_acceptances (batch_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_migrations (
        name varchar(128) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  } catch (e) {
    console.warn("Schema migration (optional):", e);
  }

  if (!process.env.MESSAGE_AT_REST_KEY) {
    console.warn("[Security] MESSAGE_AT_REST_KEY не задан — сообщения хранятся без шифрования at-rest. Задайте ключ в production.");
  }

  startMetricsRefresh();

  const app = new Elysia({
    websocket: { perMessageDeflate: false },
  })
    .onRequest(() => {
      incrementRequestCount();
      trackHttpRequest();
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
    .use(metricsRoutes)
    .use(rateLimitPlugin({ prefix: "global", windowSec: 60, max: 300 }))
    .use(rateLimitPlugin({ prefix: "auth", windowSec: 60, max: 30 }))
    .use(legalRoutes)
    .use(authRoutes)
    .use(authLegalRoutes)
    .use(adminRoutes)
    .use(adminReportsRoutes)
    .use(adminLegalRoutes)
    .use(adminObservabilityRoutes)
    .use(coinRoutes)
    .use(pushRoutes)
    .use(isE2eEnabled() ? e2eRoutes : new Elysia())
    .use(chatRoutes)
    .use(chatFolderRoutes)
    .use(contactRoutes)
    .use(blockRoutes)
    .use(stickerPackRoutes)
    .use(uploadRoutes)
    .use(reportsRoutes)
    .use(mediaRoutes)
    .ws("/ws", wsHandlers);

  app.listen({ port: PORT, hostname: "0.0.0.0" });
  const server = (app as { server?: { publish: (topic: string, data: string) => number } }).server;
  if (server) {
    setWSServer(server);
    setupRedisSubscriber(server);
  }
  console.log(`API + WS on http://localhost:${PORT}`);
  if (isE2eEnabled()) console.log("[E2E] Test routes enabled at /e2e/*");

  // Одноразовые фоновые миграции данных. Не блокируют старт сервиса и
  // защищены маркером в app_migrations, чтобы не выполняться при каждом рестарте.
  void runOneTimeDataMigrations();
}

const MIGRATION_MEDIA_DIMENSIONS = "media_dimensions_backfill_v1";

async function runOneTimeDataMigrations(): Promise<void> {
  try {
    const done = (await db.execute(
      sql`SELECT 1 FROM app_migrations WHERE name = ${MIGRATION_MEDIA_DIMENSIONS} LIMIT 1`
    )) as unknown as { length: number };
    if (done.length > 0) return;

    console.log(`[migrate] ${MIGRATION_MEDIA_DIMENSIONS}: бэкфилл размеров медиа запущен…`);
    const { scanned, updated } = await backfillMediaDimensions({
      log: (m) => console.log(`[migrate] ${m}`),
    });
    await db.execute(
      sql`INSERT INTO app_migrations (name) VALUES (${MIGRATION_MEDIA_DIMENSIONS}) ON CONFLICT (name) DO NOTHING`
    );
    console.log(
      `[migrate] ${MIGRATION_MEDIA_DIMENSIONS}: готово — размеры добавлены к ${updated} из ${scanned} сообщений.`
    );
  } catch (e) {
    // Не помечаем как выполненную — повторится при следующем рестарте.
    console.warn(`[migrate] ${MIGRATION_MEDIA_DIMENSIONS} failed (повторим позже):`, e);
  }
}

main();
