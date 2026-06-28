/**
 * Перешифровка сообщений в ScyllaDB активным ключом MESSAGE_AT_REST_KEY.
 *
 * Запуск (на сервере или локально с DATABASE_URL + Scylla):
 *   bun run apps/api/src/db/reencryptMessages.ts
 *   bun run apps/api/src/db/reencryptMessages.ts --dry-run
 */
import { db, chats } from "../db";
import { initScylla, getMessageRowsRaw, updateMessageAtRest } from "../services/scylla";
import { getActiveAtRestKeyId, needsReencryption, reencryptAtRest } from "../crypto/atRest";

const dryRun = process.argv.includes("--dry-run");
const PAGE = 200;

async function reencryptChat(chatId: string): Promise<{ scanned: number; updated: number }> {
  let scanned = 0;
  let updated = 0;
  let before: string | undefined;

  for (;;) {
    const batch = await getMessageRowsRaw(chatId, PAGE, before);
    if (batch.length === 0) break;

    for (const row of batch) {
      scanned++;
      const contentNeeds = needsReencryption(row.content);
      const metaNeeds = needsReencryption(row.attachment_metadata);
      if (!contentNeeds && !metaNeeds) continue;

      const newContent = contentNeeds ? reencryptAtRest(row.content) ?? row.content : row.content;
      const newMeta = metaNeeds
        ? reencryptAtRest(row.attachment_metadata) ?? row.attachment_metadata
        : row.attachment_metadata;

      if (newContent === row.content && newMeta === row.attachment_metadata) continue;

      if (!dryRun) {
        await updateMessageAtRest(chatId, row.message_id, newContent, newMeta);
      }
      updated++;
    }

    if (batch.length < PAGE) break;
    before = batch[batch.length - 1]!.message_id;
  }

  return { scanned, updated };
}

async function main() {
  await initScylla();
  const activeId = getActiveAtRestKeyId();
  if (!activeId) {
    console.error("MESSAGE_AT_REST_KEY не задан — нечего перешифровывать.");
    process.exit(1);
  }

  console.log(`Активный ключ: ${activeId}${dryRun ? " (dry-run)" : ""}`);

  const chatRows = await db.select({ id: chats.id }).from(chats);
  let totalScanned = 0;
  let totalUpdated = 0;

  for (const { id } of chatRows) {
    const { scanned, updated } = await reencryptChat(id);
    totalScanned += scanned;
    totalUpdated += updated;
    if (updated > 0) {
      console.log(`  chat ${id}: ${updated}/${scanned} сообщений`);
    }
  }

  console.log(`Готово: перешифровано ${totalUpdated} из ${totalScanned} сообщений.`);
  if (dryRun) console.log("Запустите без --dry-run, чтобы применить изменения.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
