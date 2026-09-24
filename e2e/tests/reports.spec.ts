import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("shows an empty state when there is nothing tracked", async ({ page }) => {
  await registerAndLogin(page);
  await page.getByRole("link", { name: "Rapports" }).click();
  await expect(page.getByText("Aucune donnée pour cette période").first()).toBeVisible();
});
