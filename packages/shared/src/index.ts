// Shared types between API and Web

export type ChatType = "dm" | "group";

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  /** X25519 public key (base64) for E2E encryption */
  publicKey?: string | null;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  members: (User & { role: string })[];
  unreadCount?: number;
}

/** Message content type */
export type MessageType = "text" | "image" | "file" | "video" | "location" | "voice";

/** Attachment metadata (JSON) */
export interface AttachmentMetadata {
  /** Original file name */
  fileName?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
  /** Voice: duration in seconds */
  duration?: number;
  /** Location: lat, lng */
  lat?: number;
  lng?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  /** Plain text or E2E ciphertext (base64) */
  content: string;
  createdAt: string;
  sender?: User;
  /** Default "text" */
  messageType?: MessageType;
  /** URL to attachment (e.g. /uploads/xxx) */
  attachmentUrl?: string | null;
  /** JSON metadata for attachment */
  attachmentMetadata?: AttachmentMetadata | null;
  /** True if content is E2E encrypted */
  encrypted?: boolean;
}

// WebSocket message types
export type WSClientMessage =
  | { type: "auth"; token: string }
  | { type: "subscribe"; chatId: string }
  | { type: "unsubscribe"; chatId: string }
  | {
      type: "message";
      chatId: string;
      content: string;
      messageType?: MessageType;
      attachmentUrl?: string | null;
      attachmentMetadata?: AttachmentMetadata | null;
      encrypted?: boolean;
    }
  | { type: "typing"; chatId: string; isTyping: boolean };

export type WSServerMessage =
  | { type: "auth_ok"; user: User }
  | { type: "auth_error"; error: string }
  | { type: "message"; message: Message }
  | { type: "typing"; chatId: string; userId: string; isTyping: boolean }
  | { type: "presence"; userId: string; online: boolean }
  | { type: "error"; error: string };
