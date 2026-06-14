/**
 * Validates required environment variables in production.
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  for (const key of ["JWT_SECRET", "DATABASE_URL", "REDIS_URL", "WEB_URL", "YANDEX_CLIENT_ID", "YANDEX_CLIENT_SECRET"]) {
    if (!process.env[key]?.trim()) missing.push(key);
  }

  if (!process.env.MESSAGE_AT_REST_KEY?.trim()) {
    missing.push("MESSAGE_AT_REST_KEY");
  }

  if (missing.length > 0) {
    console.error("[Startup] Missing required production env:", missing.join(", "));
    process.exit(1);
  }

  const jwt = process.env.JWT_SECRET ?? "";
  if (/dev|change|docker|secret/i.test(jwt) && jwt.length < 32) {
    console.error("[Startup] JWT_SECRET looks like a default value — set a strong secret in production.");
    process.exit(1);
  }

  if (process.env.E2E_TEST_SECRET) {
    console.warn("[Startup] E2E_TEST_SECRET is set in production — disable for public deploys.");
  }
}
