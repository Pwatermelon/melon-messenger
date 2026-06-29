import type { Message, MessageAttachment } from "@melon/shared";
import { canonicalStoragePath } from "./mediaUrl";

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

export function isGifAttachment(a: Pick<MessageAttachment, "url" | "mimeType">): boolean {
  return a.mimeType === "image/gif" || /\.gif$/i.test(a.url.split("?")[0] ?? "");
}

export function isAlbumImageFile(file: File): boolean {
  if (file.type === "image/gif" || /\.gif$/i.test(file.name)) return true;
  if (!file.type.startsWith("image/")) return false;
  return !file.type.includes("svg");
}

export async function fileLooksLikeGif(file: File): Promise<boolean> {
  if (file.type === "image/gif" || /\.gif$/i.test(file.name)) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    return head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;
  } catch {
    return false;
  }
}

export function getMessageAttachments(m: Pick<Message, "attachmentUrl" | "attachmentMetadata">): MessageAttachment[] {
  const list = m.attachmentMetadata?.attachments;
  if (list?.length) return list;
  if (m.attachmentUrl) {
    return [
      {
        url: m.attachmentUrl,
        fileName: m.attachmentMetadata?.fileName,
        mimeType: m.attachmentMetadata?.mimeType,
        size: m.attachmentMetadata?.size,
        width: m.attachmentMetadata?.width,
        height: m.attachmentMetadata?.height,
      },
    ];
  }
  return [];
}

export function collectMessageMediaPaths(m: Pick<Message, "attachmentUrl" | "attachmentMetadata">): string[] {
  const paths: string[] = [];
  for (const a of getMessageAttachments(m)) {
    if (a.url && !paths.includes(a.url)) paths.push(a.url);
  }
  const poster = m.attachmentMetadata?.posterUrl;
  if (poster && !paths.includes(poster)) paths.push(poster);
  return paths;
}

export function applySignedPathsToMessage(m: Message, signed: Record<string, string>): Message {
  const resolve = (path: string | null | undefined): string | null | undefined => {
    if (!path) return path;
    if (signed[path]) return signed[path];
    const canonical = canonicalStoragePath(path);
    if (signed[canonical]) return signed[canonical];
    return path;
  };

  let attachmentUrl = resolve(m.attachmentUrl) ?? m.attachmentUrl;

  let attachmentMetadata = m.attachmentMetadata;
  if (attachmentMetadata) {
    attachmentMetadata = {
      ...attachmentMetadata,
      ...(attachmentMetadata.posterUrl
        ? { posterUrl: resolve(attachmentMetadata.posterUrl) ?? attachmentMetadata.posterUrl }
        : {}),
      ...(attachmentMetadata.attachments?.length
        ? {
            attachments: attachmentMetadata.attachments.map((a) => ({
              ...a,
              url: resolve(a.url) ?? a.url,
            })),
          }
        : {}),
    };
  }

  return { ...m, attachmentUrl, attachmentMetadata };
}

export function chunkFiles<T>(files: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < files.length; i += size) out.push(files.slice(i, i + size));
  return out;
}
