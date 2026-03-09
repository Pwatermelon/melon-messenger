/**
 * WebSocket handler: auth via first message, subscribe to chats, broadcast via Redis.
 * For horizontal scaling: each instance subscribes to Redis channels and server.publish() to local WS.
 */
import type { ServerWebSocket } from "bun";
import * as jose from "jose";
import { db, users, chatMembers } from "./db";
import { eq, and } from "drizzle-orm";
import * as scylla from "./services/scylla";
import * as redis from "./services/redis";
import type { WSClientMessage, WSServerMessage, Message } from "@melon/shared";

const JWT_SECRET = process.env.JWT_SECRET ?? "melon-dev-secret-change-in-prod";
const JWT_SECRET_BYTES = new TextEncoder().encode(JWT_SECRET);

type WSData = {
  userId: string | null;
  subscribedChats: Set<string>;
};

function send(ws: ServerWebSocket<WSData>, msg: WSServerMessage): void {
  ws.send(JSON.stringify(msg));
}

let wsServerRef: { publish: (topic: string, data: string) => number } | null = null;

export function setWSServer(server: { publish: (topic: string, data: string) => number }) {
  wsServerRef = server;
}

function chatTopic(chatId: string) {
  return `chat:${chatId}`;
}

export const wsHandlers = {
  data: {} as WSData,

  open(ws: ServerWebSocket<WSData>) {
    ws.data = { userId: null, subscribedChats: new Set() };
  },

  async message(ws: ServerWebSocket<WSData>, raw: string | Buffer) {
      try {
      const str = typeof raw === "string" ? raw : raw.toString();
      let msg: WSClientMessage;
      try {
        msg = JSON.parse(str) as WSClientMessage;
      } catch {
        send(ws, { type: "error", error: "Invalid JSON" });
        return;
      }

      if (msg.type === "auth") {
        if (ws.data.userId) {
          const [u] = await db.select().from(users).where(eq(users.id, ws.data.userId)).limit(1);
          if (u) {
            send(ws, {
              type: "auth_ok",
              user: {
                id: u.id,
                email: u.email,
                username: u.username,
                avatarUrl: u.avatarUrl,
                createdAt: u.createdAt?.toISOString?.() ?? "",
              },
            });
          }
          return;
        }
        try {
          const { payload } = await jose.jwtVerify(msg.token, JWT_SECRET_BYTES);
          if (!payload?.sub || typeof payload.sub !== "string") throw new Error("Invalid token");
          const [u] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
          if (!u) throw new Error("User not found");
          ws.data.userId = u.id;
          const authOk = {
            type: "auth_ok" as const,
            user: {
              id: u.id,
              email: u.email,
              username: u.username,
              avatarUrl: u.avatarUrl,
              createdAt: u.createdAt?.toISOString?.() ?? "",
            },
          };
          send(ws, authOk);
          redis.setPresence(u.id).catch((err) => console.warn("[WS] setPresence failed:", err));
        } catch (e) {
          send(ws, { type: "auth_error", error: String(e) });
        }
        return;
      }

      if (!ws.data.userId) {
        send(ws, { type: "error", error: "Authenticate first" });
        return;
      }

      if (msg.type === "subscribe") {
        const { chatId } = msg;
        if (!chatId) return;
        ws.subscribe(chatTopic(chatId));
        ws.data.subscribedChats.add(chatId);
        return;
      }

      if (msg.type === "unsubscribe") {
        const { chatId } = msg;
        ws.unsubscribe(chatTopic(chatId));
        ws.data.subscribedChats.delete(chatId ?? "");
        return;
      }

      if (msg.type === "message") {
        const { chatId, content, messageType, attachmentUrl, attachmentMetadata, encrypted } = msg;
        if (!chatId || content == null) {
          send(ws, { type: "error", error: "chatId and content required" });
          return;
        }
        const [member] = await db
          .select()
          .from(chatMembers)
          .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, ws.data.userId)))
          .limit(1);
        if (!member) {
          send(ws, { type: "error", error: "Not a member of this chat" });
          return;
        }
        try {
          const { messageId, createdAt } = await scylla.insertMessage(
            chatId,
            ws.data.userId,
            content,
            {
              messageType: messageType ?? "text",
              attachmentUrl: attachmentUrl ?? null,
              attachmentMetadata: attachmentMetadata ?? null,
              encrypted: encrypted ?? false,
            }
          );
          const [u] = await db.select().from(users).where(eq(users.id, ws.data.userId)).limit(1);
          const message: Message = {
            id: messageId,
            chatId,
            senderId: ws.data.userId,
            content,
            createdAt: createdAt.toISOString(),
            sender: u
              ? {
                  id: u.id,
                  email: u.email,
                  username: u.username,
                  avatarUrl: u.avatarUrl,
                  publicKey: u.publicKey ?? null,
                  createdAt: u.createdAt?.toISOString?.(),
                }
              : undefined,
            messageType: messageType ?? "text",
            attachmentUrl: attachmentUrl ?? null,
            attachmentMetadata: attachmentMetadata ?? null,
            encrypted: encrypted ?? false,
          };
          const payload: WSServerMessage = { type: "message", message };
          await redis.publishToChat(chatId, JSON.stringify(payload));
          wsServerRef?.publish(chatTopic(chatId), JSON.stringify(payload));
        } catch (e) {
          send(ws, { type: "error", error: String(e) });
        }
        return;
      }

      if (msg.type === "typing") {
        const { chatId, isTyping } = msg;
        if (!chatId) return;
        const payload: WSServerMessage = {
          type: "typing",
          chatId,
          userId: ws.data.userId,
          isTyping: !!isTyping,
        };
        wsServerRef?.publish(chatTopic(chatId), JSON.stringify(payload));
      }
      } catch (err) {
        console.error("[WS] message error:", err);
        try {
          send(ws, { type: "error", error: "Server error" });
        } catch {}
      }
    },

  close(ws: ServerWebSocket<WSData>) {
    if (ws.data.userId) redis.removePresence(ws.data.userId);
  },
};

export function setupRedisSubscriber(server: { publish: (topic: string, data: string) => number }) {
  redis.redisSub.psubscribe(`${redis.WS_CHANNEL_PREFIX}*`);
  redis.redisSub.on("pmessage", (_pattern, channel, payload) => {
    const chatId = channel.replace(redis.WS_CHANNEL_PREFIX, "");
    server.publish(chatTopic(chatId), payload);
  });
}
