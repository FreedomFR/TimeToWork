import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("logs in without a password from the dev quick-login list when DEV_MODE is enabled", async ({
  page,
}) => {
  const user = await registerAndLogin(page);
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/login/);

  const devBadge = page.getByText("DEV", { exact: true });
  const isDevModeOn = await devBadge.isVisible().catch(() => false);
  test.skip(!isDevModeOn, "DEV_MODE is not enabled on this stack — skipping dev quick-login test");

  await page.getByText(user.name, { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
});
