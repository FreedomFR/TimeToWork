import fs from "fs";
import { test as setup } from "@playwright/test";
import { AUTH_DIR, CREDENTIALS_FILE, registerViaUi, uniqueUser } from "./helpers";

/**
 * Runs once before every other test. It creates a test account by going through the real
 * register page and saves its credentials, for the login tests (which only read it).
 *
 * If this fails, nothing else can work (no account), so Playwright skips all the other
 * tests instead of letting each one fail on its own.
 */
setup("create the test account through the register page", async ({ page }) => {
  const user = uniqueUser();
  await registerViaUi(page, user);

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(user));
});
