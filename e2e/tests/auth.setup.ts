import fs from "fs";
import { test as setup } from "@playwright/test";
import { AUTH_DIR, CREDENTIALS_FILE, STORAGE_STATE, registerViaUi, uniqueUser } from "./helpers";

/**
 * Runs once before every other test. It creates the shared test account by going through
 * the real register page, then saves the signed-in session and the credentials.
 *
 * If this fails, nothing else can work (no account), so Playwright skips all the other
 * tests instead of letting each one fail on its own.
 */
setup("create the shared test account", async ({ page }) => {
  const user = uniqueUser();
  await registerViaUi(page, user);

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(user));
});
