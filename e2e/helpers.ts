const apiURL = process.env.E2E_API_URL ?? "http://localhost:3000";
const e2eSecret = process.env.E2E_TEST_SECRET ?? "watermelon-e2e-secret";

export interface E2ESession {
  token: string;
  user: { id: string; username: string; betaApproved?: boolean };
}

export async function createE2ESession(opts: {
  username: string;
  betaApproved?: boolean;
  isAdmin?: boolean;
}): Promise<E2ESession> {
  const res = await fetch(`${apiURL}/e2e/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-e2e-secret": e2eSecret,
    },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`E2E session failed: ${res.status}`);
  return res.json() as Promise<E2ESession>;
}

export async function approveE2EUser(userId: string): Promise<void> {
  const res = await fetch(`${apiURL}/e2e/approve/${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "x-e2e-secret": e2eSecret },
  });
  if (!res.ok) throw new Error(`E2E approve failed: ${res.status}`);
}

export async function injectSession(page: import("@playwright/test").Page, session: E2ESession) {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem("wm_token", token);
      localStorage.setItem("wm_user", JSON.stringify(user));
    },
    { token: session.token, user: session.user }
  );
}

export async function cleanupE2EUser(email: string) {
  await fetch(`${apiURL}/e2e/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: { "x-e2e-secret": e2eSecret },
  }).catch(() => {});
}
