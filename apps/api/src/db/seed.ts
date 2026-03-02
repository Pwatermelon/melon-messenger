/**
 * Тестовые пользователи для входа.
 * Запуск: bun run db:seed (из apps/api)
 */
import { db, users } from "./index";

const TEST_PASSWORD = "password123";

async function seed() {
  const passwordHash = await Bun.password.hash(TEST_PASSWORD, {
    algorithm: "bcrypt",
    cost: 10,
  });

  await db
    .insert(users)
    .values([
      { email: "alice@test.local", passwordHash, username: "alice" },
      { email: "bob@test.local", passwordHash, username: "bob" },
      { email: "charlie@test.local", passwordHash, username: "charlie" },
    ])
    .onConflictDoNothing({ target: users.email });

  console.log("Seed OK. Test users (password for all: " + TEST_PASSWORD + "):");
  console.log("  alice@test.local / alice");
  console.log("  bob@test.local / bob");
  console.log("  charlie@test.local / charlie");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
