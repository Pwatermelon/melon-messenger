/**
 * ScyllaDB/Cassandra client for message storage.
 * Messages are append-only, time-ordered — ideal for ScyllaDB.
 */
import { Client, types } from "cassandra-driver";
import type { MessageType, AttachmentMetadata } from "@melon/shared";

const contactPoints = (process.env.SCYLLA_CONTACT_POINTS ?? "127.0.0.1").split(",");
const keyspace = process.env.SCYLLA_KEYSPACE ?? "melon";

export const scyllaClient = new Client({
  contactPoints,
  localDataCenter: process.env.SCYLLA_DATACENTER ?? "datacenter1",
  keyspace,
});

const MESSAGES_TABLE = "messages";

export async function initScylla(): Promise<void> {
  const adminClient = new Client({
    contactPoints,
    localDataCenter: process.env.SCYLLA_DATACENTER ?? "datacenter1",
  });
  await adminClient.execute(`
    CREATE KEYSPACE IF NOT EXISTS ${keyspace}
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
  `);
  await adminClient.execute(`
    CREATE TABLE IF NOT EXISTS ${keyspace}.${MESSAGES_TABLE} (
      chat_id uuid,
      message_id timeuuid,
      sender_id uuid,
      content text,
      created_at timestamp,
      message_type text,
      attachment_url text,
      attachment_metadata text,
      encrypted boolean,
      PRIMARY KEY (chat_id, message_id)
    ) WITH CLUSTERING ORDER BY (message_id DESC)
  `);
  try {
    await adminClient.execute(`ALTER TABLE ${keyspace}.${MESSAGES_TABLE} ADD message_type text`);
  } catch {}
  try {
    await adminClient.execute(`ALTER TABLE ${keyspace}.${MESSAGES_TABLE} ADD attachment_url text`);
  } catch {}
  try {
    await adminClient.execute(`ALTER TABLE ${keyspace}.${MESSAGES_TABLE} ADD attachment_metadata text`);
  } catch {}
  try {
    await adminClient.execute(`ALTER TABLE ${keyspace}.${MESSAGES_TABLE} ADD encrypted boolean`);
  } catch {}
  await adminClient.shutdown();
}

export interface MessageRow {
  chat_id: string;
  message_id: string;
  sender_id: string;
  content: string;
  created_at: Date;
  message_type?: string | null;
  attachment_url?: string | null;
  attachment_metadata?: string | null;
  encrypted?: boolean | null;
}

const insertQuery = `INSERT INTO ${MESSAGES_TABLE} (chat_id, message_id, sender_id, content, created_at, message_type, attachment_url, attachment_metadata, encrypted)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const selectQuery = `SELECT chat_id, message_id, sender_id, content, created_at, message_type, attachment_url, attachment_metadata, encrypted
  FROM ${MESSAGES_TABLE} WHERE chat_id = ? LIMIT ?`;
const selectFromQuery = `SELECT chat_id, message_id, sender_id, content, created_at, message_type, attachment_url, attachment_metadata, encrypted
  FROM ${MESSAGES_TABLE} WHERE chat_id = ? AND message_id < ? LIMIT ?`;

export interface InsertMessageOpts {
  messageType?: MessageType;
  attachmentUrl?: string | null;
  attachmentMetadata?: AttachmentMetadata | null;
  encrypted?: boolean;
}

export async function insertMessage(
  chatId: string,
  senderId: string,
  content: string,
  opts: InsertMessageOpts = {}
): Promise<{ messageId: string; createdAt: Date }> {
  const id = types.TimeUuid.now();
  const createdAt = id.getDate();
  const messageType = opts.messageType ?? "text";
  const attachmentUrl = opts.attachmentUrl ?? null;
  const attachmentMetadata = opts.attachmentMetadata != null ? JSON.stringify(opts.attachmentMetadata) : null;
  const encrypted = opts.encrypted ?? false;
  await scyllaClient.execute(
    insertQuery,
    [chatId, id, senderId, content, createdAt, messageType, attachmentUrl, attachmentMetadata, encrypted],
    { prepare: true }
  );
  return { messageId: id.toString(), createdAt };
}

export async function getMessages(
  chatId: string,
  limit: number,
  beforeMessageId?: string
): Promise<MessageRow[]> {
  const params = beforeMessageId
    ? [chatId, beforeMessageId, limit]
    : [chatId, limit];
  const query = beforeMessageId ? selectFromQuery : selectQuery;
  const result = await scyllaClient.execute(query, params, { prepare: true });
  return result.rows.map((row) => {
    let attachment_metadata: string | null = null;
    try {
      if (row.attachment_metadata != null) attachment_metadata = String(row.attachment_metadata);
    } catch {}
    return {
      chat_id: row.chat_id?.toString(),
      message_id: row.message_id?.toString(),
      sender_id: row.sender_id?.toString(),
      content: row.content,
      created_at: row.created_at,
      message_type: row.message_type != null ? String(row.message_type) : null,
      attachment_url: row.attachment_url != null ? String(row.attachment_url) : null,
      attachment_metadata,
      encrypted: row.encrypted === true,
    };
  }) as MessageRow[];
}
