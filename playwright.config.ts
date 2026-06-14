import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? (process.env.CI ? "http://localhost:8080" : "http://localhost:5173");
const apiURL = process.env.E2E_API_URL ?? `${baseURL}/api`;
const e2eSecret = process.env.E2E_TEST_SECRET ?? "watermelon-e2e-secret";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: "bun run --cwd apps/api dev",
          url: "http://localhost:3000/health",
          reuseExistingServer: true,
          env: {
            ...process.env,
            E2E_TEST_SECRET: e2eSecret,
            PORT: "3000",
          },
        },
        {
          command: "bun run --cwd apps/web dev",
          url: "http://localhost:5173",
          reuseExistingServer: true,
          env: {
            VITE_API_URL: "http://localhost:3000",
            VITE_WS_URL: "ws://localhost:3000/ws",
          },
        },
      ],
});

export { apiURL, e2eSecret };
