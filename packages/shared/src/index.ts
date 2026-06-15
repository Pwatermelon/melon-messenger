// Shared types between API and Web

export type ChatType = "dm" | "group";
export type SubscriptionTier = "free" | "platinum";

export * from "./birthday";

export interface User {
  id: string;
  email?: string;
  username: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  profilePhotos?: string[];
  createdAt: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string | null;
  yandexId?: string | null;
  yandexLogin?: string | null;
  birthday?: string | null;
  birthdayVisible?: boolean;
  birthdayLabel?: string | null;
  birthdayAge?: number | null;
  isBirthdayToday?: boolean;
  avatarHistory?: string[];
  betaApproved?: boolean;
  isAdmin?: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  members: (User & { role: string })[];
  unreadCount?: number;
}

/** Message content type */
export type MessageType = "text" | "image" | "file" | "video" | "location" | "voice" | "circle";

/** Attachment metadata (JSON) */
export interface AttachmentMetadata {
  fileName?: string;
  mimeType?: string;
  size?: number;
  duration?: number;
  lat?: number;
  lng?: number;
  forwardedFrom?: { userId: string; username: string };
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: User;
  messageType?: MessageType;
  attachmentUrl?: string | null;
  attachmentMetadata?: AttachmentMetadata | null;
}

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
    }
  | { type: "typing"; chatId: string; isTyping: boolean };

export type WSServerMessage =
  | { type: "auth_ok"; user: User }
  | { type: "auth_error"; error: string }
  | { type: "message"; message: Message }
  | { type: "message_deleted"; chatId: string; messageId: string }
  | { type: "typing"; chatId: string; userId: string; isTyping: boolean }
  | { type: "presence"; userId: string; online: boolean }
  | { type: "error"; error: string };
