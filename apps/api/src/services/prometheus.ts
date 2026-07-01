import { Registry, Counter, Gauge, collectDefaultMetrics } from "prom-client";
import { sql, eq, and, isNotNull } from "drizzle-orm";
import { db, users, chats, pushSubscriptions, stickerPacks, userBlocks, reports } from "../db";
import { getWsStats } from "../wsRegistry";

export const register = new Registry();

collectDefaultMetrics({ register, prefix: "wm_" });

export const httpRequestsTotal = new Counter({
  name: "wm_http_requests_total",
  help: "Total HTTP requests handled by the API",
  registers: [register],
});

export const messagesTotal = new Counter({
  name: "wm_messages_total",
  help: "Total chat messages created",
  registers: [register],
});

export const usersTotal = new Gauge({
  name: "wm_users_total",
  help: "Registered users with Yandex ID",
  registers: [register],
});

export const betaPendingUsers = new Gauge({
  name: "wm_beta_pending_users",
  help: "Users waiting for beta approval",
  registers: [register],
});

export const chatsTotal = new Gauge({
  name: "wm_chats_total",
  help: "Total chats",
  registers: [register],
});

export const groupChatsTotal = new Gauge({
  name: "wm_group_chats_total",
  help: "Group chats",
  registers: [register],
});

export const pushSubscriptionsTotal = new Gauge({
  name: "wm_push_subscriptions_total",
  help: "Active browser push subscriptions",
  registers: [register],
});

export const wsConnections = new Gauge({
  name: "wm_ws_connections",
  help: "Open WebSocket connections",
  registers: [register],
});

export const wsUsersOnline = new Gauge({
  name: "wm_ws_users_online",
  help: "Users with at least one open WebSocket",
  registers: [register],
});

export const platinumUsers = new Gauge({
  name: "wm_platinum_users_total",
  help: "Users with active platinum subscription",
  registers: [register],
});

export const coinsTotal = new Gauge({
  name: "wm_coins_total",
  help: "Sum of all user coin balances",
  registers: [register],
});

export const usersWithCoins = new Gauge({
  name: "wm_users_with_coins_total",
  help: "Users with coin balance greater than zero",
  registers: [register],
});

export const userCoins = new Gauge({
  name: "wm_user_coins",
  help: "Coin balance per user",
  labelNames: ["user_id", "username"] as const,
  registers: [register],
});

export const dmChatsTotal = new Gauge({
  name: "wm_dm_chats_total",
  help: "Direct message chats",
  registers: [register],
});

export const stickerPacksTotal = new Gauge({
  name: "wm_sticker_packs_total",
  help: "Sticker packs created",
  registers: [register],
});

export const reportsOpenTotal = new Gauge({
  name: "wm_reports_open_total",
  help: "Open user reports",
  registers: [register],
});

export const userBlocksTotal = new Gauge({
  name: "wm_user_blocks_total",
  help: "User block relationships",
  registers: [register],
});

const trackedUserCoinLabels = new Map<string, { user_id: string; username: string }>();

let refreshTimer: ReturnType<typeof setInterval> | null = null;

async function refreshCoinMetrics(): Promise<void> {
  const rows = await db
    .select({ id: users.id, username: users.username, coins: users.coinBalance })
    .from(users)
    .where(isNotNull(users.yandexId));

  let total = 0;
  let withCoins = 0;
  const nextTracked = new Map<string, { user_id: string; username: string }>();

  for (const row of rows) {
    const coins = row.coins ?? 0;
    total += coins;
    if (coins > 0) withCoins += 1;
    const labels = { user_id: row.id, username: row.username };
    userCoins.labels(labels).set(coins);
    nextTracked.set(row.id, labels);
  }

  coinsTotal.set(total);
  usersWithCoins.set(withCoins);

  for (const [id, labels] of trackedUserCoinLabels) {
    if (!nextTracked.has(id)) {
      userCoins.remove(labels);
    }
  }
  trackedUserCoinLabels.clear();
  for (const [id, labels] of nextTracked) {
    trackedUserCoinLabels.set(id, labels);
  }
}

async function refreshBusinessGauges(): Promise<void> {
  try {
    const [
      [userRow],
      [chatRow],
      [groupRow],
      [pendingRow],
      [pushRow],
      [platinumRow],
      [dmRow],
      [stickerRow],
      [reportsRow],
      [blocksRow],
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(isNotNull(users.yandexId)),
      db.select({ count: sql<number>`count(*)::int` }).from(chats),
      db.select({ count: sql<number>`count(*)::int` }).from(chats).where(eq(chats.type, "group")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(isNotNull(users.yandexId), eq(users.betaApproved, false))),
      db.select({ count: sql<number>`count(*)::int` }).from(pushSubscriptions),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.subscriptionTier, "platinum")),
      db.select({ count: sql<number>`count(*)::int` }).from(chats).where(eq(chats.type, "dm")),
      db.select({ count: sql<number>`count(*)::int` }).from(stickerPacks),
      db.select({ count: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, "open")),
      db.select({ count: sql<number>`count(*)::int` }).from(userBlocks),
    ]);

    usersTotal.set(userRow?.count ?? 0);
    chatsTotal.set(chatRow?.count ?? 0);
    groupChatsTotal.set(groupRow?.count ?? 0);
    betaPendingUsers.set(pendingRow?.count ?? 0);
    pushSubscriptionsTotal.set(pushRow?.count ?? 0);
    platinumUsers.set(platinumRow?.count ?? 0);
    dmChatsTotal.set(dmRow?.count ?? 0);
    stickerPacksTotal.set(stickerRow?.count ?? 0);
    reportsOpenTotal.set(reportsRow?.count ?? 0);
    userBlocksTotal.set(blocksRow?.count ?? 0);
  } catch (err) {
    console.warn("[metrics] refresh failed:", err);
  }

  try {
    await refreshCoinMetrics();
  } catch (err) {
    console.warn("[metrics] coin refresh failed:", err);
  }

  const ws = getWsStats();
  wsConnections.set(ws.connections);
  wsUsersOnline.set(ws.users);
}

export function startMetricsRefresh(): void {
  void refreshBusinessGauges();
  if (refreshTimer) return;
  refreshTimer = setInterval(() => void refreshBusinessGauges(), 30_000);
}

export function trackHttpRequest(): void {
  httpRequestsTotal.inc();
}

export function trackMessageCreated(): void {
  messagesTotal.inc();
}

export async function getPrometheusMetrics(): Promise<string> {
  await refreshBusinessGauges();
  return register.metrics();
}
