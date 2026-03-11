import type { AttachmentMetadata, MessageType } from "@melon/shared";
import { getApiUrl } from "./config";

function getToken(): string | null {
  return localStorage.getItem("melon_token");
}

export async function getChats(): Promise<
  Array<{
    id: string;
    type: string;
    name: string | null;
    createdAt: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    members: Array<{ id: string; username: string; avatarUrl: string | null; publicKey?: string | null; role: string }>;
  }>
> {
  const res = await fetch(`${getApiUrl()}/chats`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load chats");
  return res.json();
}

export async function createDm(userId: string): Promise<{
  id: string;
  type: string;
  name: string | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  members: Array<{ id: string; username: string; avatarUrl: string | null; publicKey?: string | null; role: string }>;
}> {
  const res = await fetch(`${getApiUrl()}/chats/dm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to create chat");
  }
  return res.json();
}

const chatResponseType = {
  id: "",
  type: "",
  name: null as string | null,
  avatarUrl: null as string | null,
  createdAt: "",
  lastMessageAt: null as string | null,
  lastMessagePreview: null as string | null,
  members: [] as Array<{ id: string; username: string; avatarUrl: string | null; publicKey?: string | null; role: string }>,
};

export type ChatResponse = typeof chatResponseType;

export async function createGroup(name: string, memberIds: string[]): Promise<ChatResponse> {
  const res = await fetch(`${getApiUrl()}/chats/group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ name: name.trim(), memberIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to create group");
  }
  return res.json();
}

export async function updateGroup(chatId: string, updates: { name?: string; avatarUrl?: string | null }): Promise<ChatResponse> {
  const res = await fetch(`${getApiUrl()}/chats/${encodeURIComponent(chatId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to update group");
  }
  return res.json();
}

export async function getChat(chatId: string): Promise<ChatResponse | null> {
  const res = await fetch(`${getApiUrl()}/chats/${encodeURIComponent(chatId)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function addGroupMembers(chatId: string, userIds: string[]): Promise<ChatResponse> {
  const res = await fetch(`${getApiUrl()}/chats/${encodeURIComponent(chatId)}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ userIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to add members");
  }
  return res.json();
}

export async function removeGroupMember(chatId: string, userId: string): Promise<ChatResponse> {
  const res = await fetch(
    `${getApiUrl()}/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to remove member");
  }
  return res.json();
}

export async function getUserById(id: string): Promise<{ id: string; username: string; avatarUrl: string | null } | null> {
  const res = await fetch(`${getApiUrl()}/chats/users/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateProfile(updates: { username?: string; avatarUrl?: string | null }): Promise<{
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  publicKey: string | null;
  createdAt: string | undefined;
}> {
  const res = await fetch(`${getApiUrl()}/auth/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Update failed");
  }
  return res.json();
}

export interface MessageItem {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: { id: string; username: string };
  messageType?: MessageType;
  attachmentUrl?: string | null;
  attachmentMetadata?: AttachmentMetadata | null;
  encrypted?: boolean;
}

export async function getMessages(
  chatId: string,
  limit?: number,
  before?: string
): Promise<{ messages: MessageItem[] }> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (before) params.set("before", before);
  const res = await fetch(`${getApiUrl()}/chats/${chatId}/messages?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function setPublicKey(publicKey: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/auth/me/public-key`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ publicKey }),
  });
  if (!res.ok) throw new Error("Failed to set public key");
}

export async function deleteChat(chatId: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/chats/${encodeURIComponent(chatId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to delete chat");
  }
}

export async function uploadFile(file: File): Promise<{ url: string; fileName: string; mimeType: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${getApiUrl()}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Upload failed");
  }
  const data = await res.json();
  return { url: `${getApiUrl().replace(/\/api$/, "")}${data.url}`, fileName: data.fileName, mimeType: data.mimeType, size: data.size };
}
