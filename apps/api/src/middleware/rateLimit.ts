import { Elysia } from "elysia";
import { redis } from "../services/redis";

export interface RateLimitOptions {
  windowSec: number;
  max: number;
  prefix: string;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export async function checkRateLimit(key: string, windowSec: number, max: number): Promise<boolean> {
  const redisKey = `rl:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) await redis.expire(redisKey, windowSec);
  return count <= max;
}

export function rateLimitPlugin(opts: RateLimitOptions) {
  return new Elysia({ name: `rate-limit-${opts.prefix}` }).onBeforeHandle(async ({ request, set }) => {
    const ip = clientKey(request);
    const ok = await checkRateLimit(`${opts.prefix}:${ip}`, opts.windowSec, opts.max);
    if (!ok) {
      set.status = 429;
      return { error: "Too many requests. Try again later." };
    }
  });
}
