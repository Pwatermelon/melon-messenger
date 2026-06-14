import { test, expect } from "@playwright/test";
import { cleanupE2EUser, createE2ESession, injectSession } from "./helpers";

test.describe("Chat", () => {
  let aliceId = "";
  let bobId = "";

  test.beforeAll(async () => {
    const alice = await createE2ESession({ username: "alice-e2e", betaApproved: true });
    const bob = await createE2ESession({ username: "bob-e2e", betaApproved: true });
    aliceId = alice.user.id;
    bobId = bob.user.id;
  });

  test.afterAll(async () => {
    await cleanupE2EUser("alice-e2e@e2e.test");
    await cleanupE2EUser("bob-e2e@e2e.test");
  });

  test("send DM message", async ({ page }) => {
    const alice = await createE2ESession({ username: "alice-e2e", betaApproved: true });
    await page.addInitScript(() => localStorage.setItem("wm_beta_welcome_seen", "1"));
    await injectSession(page, alice);

    await page.goto("/");
    await expect(page.getByTestId("messenger-shell")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("new-chat-btn").click();
    await page.getByTestId("new-dm-btn").click();
    await page.getByTestId("dm-user-id-input").fill(bobId);
    await page.getByTestId("dm-lookup-btn").click();
    await expect(page.getByTestId("dm-start-btn")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("dm-start-btn").click();

    const msg = `Hello from E2E ${Date.now()}`;
    await page.getByTestId("compose-input").fill(msg);
    await page.getByTestId("compose-send").click();

    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });
  });
});
