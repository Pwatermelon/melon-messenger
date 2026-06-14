import { test, expect } from "@playwright/test";
import { approveE2EUser, cleanupE2EUser, createE2ESession, injectSession } from "./helpers";

test.describe("Beta flow", () => {
  const email = "pending-user@e2e.test";

  test.afterAll(async () => {
    await cleanupE2EUser(email);
  });

  test("pending user sees beta pending page", async ({ page }) => {
    const session = await createE2ESession({ username: "pending-user", betaApproved: false });
    await injectSession(page, session);
    await page.goto("/beta/pending");
    await expect(page.getByTestId("beta-pending")).toBeVisible();
    await expect(page.getByText("Доступ к beta ещё не открыт")).toBeVisible();
  });

  test("approved user reaches messenger", async ({ page }) => {
    const session = await createE2ESession({ username: "approved-user", betaApproved: true });
    await injectSession(page, session);
    await page.goto("/");
    await expect(page.getByTestId("messenger-shell")).toBeVisible({ timeout: 15_000 });
    await cleanupE2EUser("approved-user@e2e.test");
  });

  test("admin approve unlocks pending user", async ({ page }) => {
    const session = await createE2ESession({ username: "pending-user", betaApproved: false });
    await injectSession(page, session);
    await page.goto("/beta/pending");
    await expect(page.getByTestId("beta-pending")).toBeVisible();

    await approveE2EUser(session.user.id);

    await expect(page.getByTestId("beta-welcome")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("beta-enter").click();
    await expect(page.getByTestId("messenger-shell")).toBeVisible({ timeout: 10_000 });
  });
});
