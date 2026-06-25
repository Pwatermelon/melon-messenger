/**
 * Audit users affected by legacy Yandex OAuth email bugs.
 * Run: bun run db:audit-yandex-users (from apps/api)
 */
import { isNull, or, sql } from "drizzle-orm";
import { db, users } from "./index";
import { isDefinitelyLegacySyntheticEmail, isLikelyLegacySyntheticEmail } from "../services/yandexOAuth";

type AuditRow = {
  id: string;
  email: string;
  username: string;
  yandexId: string | null;
  yandexLogin: string | null;
  createdAt: Date;
  issue: string;
};

async function audit() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      yandexId: users.yandexId,
      yandexLogin: users.yandexLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      or(
        isNull(users.yandexId),
        sql`${users.email} LIKE '%@oauth.internal'`,
        sql`${users.email} LIKE '%@yandex.ru'`
      )
    )
    .orderBy(users.createdAt);

  const flagged: AuditRow[] = [];

  for (const row of rows) {
    let issue: string | null = null;
    if (!row.yandexId) {
      issue = "orphan_no_yandex_id";
    } else if (isDefinitelyLegacySyntheticEmail(row.email, row.yandexId)) {
      issue = "legacy_synthetic_email";
    } else if (isLikelyLegacySyntheticEmail(row.email, row.yandexId, row.yandexLogin)) {
      issue = "maybe_synthetic_email";
    }

    if (issue) {
      flagged.push({ ...row, issue });
    }
  }

  const duplicateYandexIds = await db.execute<{ yandex_id: string; cnt: number }>(sql`
    SELECT yandex_id, count(*)::int AS cnt
    FROM users
    WHERE yandex_id IS NOT NULL
    GROUP BY yandex_id
    HAVING count(*) > 1
  `);

  console.log("=== Watermelon Yandex user audit ===\n");

  if (flagged.length === 0) {
    console.log("No legacy/orphan users matched heuristics.");
  } else {
    console.log(`Found ${flagged.length} user(s) to review:\n`);
    for (const u of flagged) {
      console.log(`- ${u.issue}`);
      console.log(`  id:          ${u.id}`);
      console.log(`  email:       ${u.email}`);
      console.log(`  username:    ${u.username}`);
      console.log(`  yandexId:    ${u.yandexId ?? "—"}`);
      console.log(`  yandexLogin: ${u.yandexLogin ?? "—"}`);
      console.log(`  createdAt:   ${u.createdAt.toISOString()}`);
      console.log("");
    }
  }

  const dupRows = duplicateYandexIds;
  if (dupRows.length > 0) {
    console.log("WARNING: duplicate yandex_id values (should never happen):");
    for (const d of dupRows) {
      console.log(`  yandex_id=${d.yandex_id} count=${d.cnt}`);
    }
    console.log("");
  }

  console.log("What to do:");
  console.log("  1. legacy/maybe_synthetic + has yandexId → ask user to log in again; email auto-heals.");
  console.log("  2. orphan_no_yandex_id → stale row; delete if no chats/messages.");
  console.log("  3. hijacked account (wrong username) → find real owner by yandexLogin, fix manually in DB.");
  console.log("\nDelete orphan example (only after checking chats/messages):");
  console.log("  DELETE FROM users WHERE id = '<uuid>' AND yandex_id IS NULL;");
}

audit()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
