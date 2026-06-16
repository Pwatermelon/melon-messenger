import { Elysia } from "elysia";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { redis } from "../services/redis";

const startedAt = Date.now();
let requestCount = 0;

export function incrementRequestCount() {
  requestCount += 1;
}

export const healthRoutes = new Elysia()
  .get("/health", async ({ set }) => {
    let postgres = false;
    let redisOk = false;
    try {
      await db.execute(sql`SELECT 1`);
      postgres = true;
    } catch {}
    try {
      const pong = await redis.ping();
      redisOk = pong === "PONG";
    } catch {}

    const ok = postgres && redisOk;
    if (!ok) set.status = 503;
    return {
      status: ok ? "ok" : "degraded",
      postgres,
      redis: redisOk,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    };
  })
  .get("/metrics", () => ({
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    requestsTotal: requestCount,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  }));
