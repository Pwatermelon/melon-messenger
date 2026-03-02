import { pgTable, uuid, varchar, text, timestamp, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const chatTypeEnum = pgEnum("chat_type", ["dm", "group"]);
export const memberRoleEnum = pgEnum("member_role", ["member", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  avatarUrl: text("avatar_url"),
  /** X25519 public key (base64) for E2E */
  publicKey: text("public_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: chatTypeEnum("type").notNull().default("dm"),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.chatId, t.userId] })]
);

export const usersRelations = relations(users, ({ many }) => ({
  chatMembers: many(chatMembers),
}));

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}));

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats),
  user: one(users),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type ChatMember = typeof chatMembers.$inferInsert;
