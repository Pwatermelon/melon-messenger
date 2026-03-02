/**
 * Redis: Pub/Sub for cross-instance WebSocket broadcast, presence (online/offline).
 */
import Redis from "ioredis";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(url, { maxRetriesPerRequest: null });
export const redisSub = new Redis(url, { maxRetriesPerRequest: null });

const PRESENCE_KEY = "presence";
const PRESENCE_TTL_SEC = 60;

export function presenceKey(userId: string): string {
  return `${PRESENCE_KEY}:${userId}`;
}

export async function setPresence(userId: string): Promise<void> {
  await redis.setex(presenceKey(userId), PRESENCE_TTL_SEC, "1");
}

export async function removePresence(userId: string): Promise<void> {
  await redis.del(presenceKey(userId));
}

export async function refreshPresence(userId: string): Promise<void> {
  await redis.setex(presenceKey(userId), PRESENCE_TTL_SEC, "1");
}

export async function isOnline(userId: string): Promise<boolean> {
  return (await redis.get(presenceKey(userId))) === "1";
}

export const WS_CHANNEL_PREFIX = "ws:chat:";

export function chatChannel(chatId: string): string {
  return `${WS_CHANNEL_PREFIX}${chatId}`;
}

export async function publishToChat(chatId: string, payload: string): Promise<void> {
  await redis.publish(chatChannel(chatId), payload);
}
