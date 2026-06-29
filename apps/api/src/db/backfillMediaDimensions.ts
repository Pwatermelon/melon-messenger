/**
 * Бэкфилл размеров (width/height) у старых сообщений с картинками.
 *
 * Зачем: клиент резервирует место под фото по сохранённым размерам, чтобы при
 * подгрузке ленты не дёргался скролл. У сообщений, отправленных до этой фичи,
 * размеров нет — этот код читает файлы из хранилища, вычисляет размеры и
 * дописывает их в attachment_metadata.
 *
 * Прод: запускается автоматически один раз при старте API (см. index.ts).
 * Вручную (опционально):
 *   bun run apps/api/src/db/backfillMediaDimensions.ts
 *   bun run apps/api/src/db/backfillMediaDimensions.ts --dry-run
 */
import { imageSize } from "image-size";
import type { AttachmentMetadata, MessageAttachment } from "@melon/shared";
import { db, chats } from "../db";
import { initScylla, getMessageRowsRaw, updateMessageAtRest } from "../services/scylla";
import { decryptAtRest, encryptAtRest } from "../crypto/atRest";
import { getMediaStorage, storageKeyFromPath } from "../services/mediaStorage";
import { canonicalUploadsPath } from "../services/mediaAccess";

const PAGE = 200;

function looksLikeImage(url: string | undefined, mimeType: string | undefined): boolean {
  if (mimeType?.startsWith("image/")) return true;
  const clean = (url ?? "").split("?")[0] ?? "";
  return /\.(jpe?g|png|gif|webp|bmp|avif|tiff?)$/i.test(clean);
}

/** Читает файл из хранилища и возвращает его пиксельные размеры (с учётом EXIF-поворота). */
async function dimensionsFor(
  url: string | undefined,
  cache: Map<string, { width: number; height: number } | null>,
  log: (msg: string) => void
): Promise<{ width: number; height: number } | null> {
  if (!url) return null;
  const canonical = canonicalUploadsPath(url) ?? url;
  if (cache.has(canonical)) return cache.get(canonical)!;

  let result: { width: number; height: number } | null = null;
  try {
    const obj = await getMediaStorage().get(storageKeyFromPath(canonical));
    if (obj?.body?.length) {
      const { width, height, orientation } = imageSize(obj.body);
      if (width && height) {
        // Поворот 5..8 меняет местами стороны при отображении.
        const swap = typeof orientation === "number" && orientation >= 5;
        result = swap ? { width: height, height: width } : { width, height };
      }
    }
  } catch (err) {
    log(`  ! не удалось прочитать ${canonical}: ${err instanceof Error ? err.message : String(err)}`);
  }

  cache.set(canonical, result);
  return result;
}

async function backfillChat(
  chatId: string,
  dryRun: boolean,
  cache: Map<string, { width: number; height: number } | null>,
  log: (msg: string) => void
): Promise<{ scanned: number; updated: number }> {
  let scanned = 0;
  let updated = 0;
  let before: string | undefined;

  for (;;) {
    const batch = await getMessageRowsRaw(chatId, PAGE, before);
    if (batch.length === 0) break;

    for (const row of batch) {
      scanned++;
      if (!row.attachment_metadata) continue;

      let meta: AttachmentMetadata;
      try {
        meta = JSON.parse(decryptAtRest(row.attachment_metadata)) as AttachmentMetadata;
      } catch {
        continue;
      }

      let changed = false;

      // Альбом: несколько вложений.
      if (Array.isArray(meta.attachments) && meta.attachments.length) {
        const next: MessageAttachment[] = [];
        for (const a of meta.attachments) {
          if ((!a.width || !a.height) && looksLikeImage(a.url, a.mimeType)) {
            const dims = await dimensionsFor(a.url, cache, log);
            if (dims) {
              next.push({ ...a, ...dims });
              changed = true;
              continue;
            }
          }
          next.push(a);
        }
        if (changed) meta.attachments = next;
      } else if ((!meta.width || !meta.height) && row.message_type === "image" && row.attachment_url) {
        // Одиночная картинка.
        if (looksLikeImage(row.attachment_url, meta.mimeType)) {
          const dims = await dimensionsFor(row.attachment_url, cache, log);
          if (dims) {
            meta.width = dims.width;
            meta.height = dims.height;
            changed = true;
          }
        }
      }

      if (!changed) continue;

      if (!dryRun) {
        const encryptedMeta = encryptAtRest(JSON.stringify(meta));
        await updateMessageAtRest(chatId, row.message_id, row.content, encryptedMeta);
      }
      updated++;
    }

    if (batch.length < PAGE) break;
    before = batch[batch.length - 1]!.message_id;
  }

  return { scanned, updated };
}

export interface BackfillOptions {
  dryRun?: boolean;
  log?: (msg: string) => void;
}

/**
 * Проходит по всем чатам и дописывает размеры картинок там, где их нет.
 * Идемпотентно: уже заполненные сообщения пропускаются.
 */
export async function backfillMediaDimensions(
  opts: BackfillOptions = {}
): Promise<{ scanned: number; updated: number }> {
  const dryRun = opts.dryRun ?? false;
  const log = opts.log ?? (() => {});
  const cache = new Map<string, { width: number; height: number } | null>();

  const chatRows = await db.select({ id: chats.id }).from(chats);
  let totalScanned = 0;
  let totalUpdated = 0;

  for (const { id } of chatRows) {
    const { scanned, updated } = await backfillChat(id, dryRun, cache, log);
    totalScanned += scanned;
    totalUpdated += updated;
    if (updated > 0) log(`  chat ${id}: ${updated}/${scanned} сообщений обновлено`);
  }

  return { scanned: totalScanned, updated: totalUpdated };
}

// CLI-режим (ручной запуск).
if (import.meta.main) {
  const dryRun = process.argv.includes("--dry-run");
  (async () => {
    await initScylla();
    console.log(`Бэкфилл размеров медиа${dryRun ? " (dry-run)" : ""}…`);
    const { scanned, updated } = await backfillMediaDimensions({
      dryRun,
      log: (m) => console.log(m),
    });
    console.log(`Готово: размеры добавлены к ${updated} из ${scanned} сообщений.`);
    if (dryRun) console.log("Запустите без --dry-run, чтобы применить изменения.");
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
