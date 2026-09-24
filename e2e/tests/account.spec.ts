import { test, expect, Page } from "@playwright/test";
import { registerAndLogin } from "./helpers";

async function openAccount(page: Page) {
  await page.getByRole("link", { name: "Mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Mon compte" })).toBeVisible();
}

async function fillPasswordForm(page: Page, current: string, next: string, confirm = next) {
  await page.locator("#current-password").fill(current);
  await page.locator("#new-password").fill(next);
  await page.locator("#confirm-new-password").fill(confirm);
  await page.getByRole("button", { name: "Mettre à jour le mot de passe" }).click();
}

test("account page shows the profile and changes the password", async ({ page }) => {
  const user = await registerAndLogin(page);
  await openAccount(page);

  const main = page.getByRole("main");
  await expect(main.getByText(user.name)).toBeVisible();
  await expect(main.getByText(user.email)).toBeVisible();

  await fillPasswordForm(page, user.password, "brand-new-password");
  await expect(page.getByText("Mot de passe mis à jour.")).toBeVisible();
  // The form is cleared after success
  await expect(page.locator("#current-password")).toHaveValue("");

  // The old password no longer works, the new one does
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();

  await page.locator("#login-password").fill("brand-new-password");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
});

test("a wrong current password shows an error and keeps the user signed in", async ({ page }) => {
  const user = await registerAndLogin(page);
  await openAccount(page);

  await fillPasswordForm(page, "not-my-password", "brand-new-password");
  await expect(page.getByText("Mot de passe actuel incorrect")).toBeVisible();

  // Still on the account page (a 401 would have redirected to /login)
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole("heading", { name: "Mon compte" })).toBeVisible();

  // The password was not changed
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
});

test("mismatching confirmation is rejected before calling the server", async ({ page }) => {
  const user = await registerAndLogin(page);
  await openAccount(page);

  await fillPasswordForm(page, user.password, "brand-new-password", "something-different");
  await expect(page.getByText("Les mots de passe ne correspondent pas")).toBeVisible();
});

test("reusing the current password as the new one is rejected", async ({ page }) => {
  const user = await registerAndLogin(page);
  await openAccount(page);

  await fillPasswordForm(page, user.password, user.password);
  await expect(page.getByText("Le nouveau mot de passe doit être différent de l'actuel")).toBeVisible();
});
