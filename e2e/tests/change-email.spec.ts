import { test, expect, Page } from "@playwright/test";
import { apiCall, createAccount, registerFreshAdmin, registerFreshUser, uniqueUser } from "./helpers";

/** Changing the email of an account from "Mon compte". Uses throwaway accounts: it changes the account. */

async function openAccount(page: Page) {
  await page.getByRole("link", { name: "Mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Mon compte" })).toBeVisible();
}

async function submitEmailChange(page: Page, newEmail: string, password: string, confirm = newEmail) {
  await page.locator("#new-email").fill(newEmail);
  await page.locator("#confirm-new-email").fill(confirm);
  await page.locator("#email-current-password").fill(password);
  await page.getByRole("button", { name: "Mettre à jour l'email" }).click();
}

test("changes the email: the page updates at once and the new address is used to sign in", async ({ page }) => {
  const user = await registerFreshUser(page);
  const newEmail = uniqueUser().email;
  await openAccount(page);

  await submitEmailChange(page, newEmail, user.password);

  await expect(page.getByText(`vous vous connecterez désormais avec ${newEmail}`)).toBeVisible();
  // The profile card and the sidebar show the new address without a reload
  await expect(page.getByRole("main").getByText(newEmail, { exact: true })).toBeVisible();
  await expect(page.locator("aside").getByText(newEmail)).toBeVisible();
  await expect(page.locator("#new-email")).toHaveValue(""); // form cleared

  // The session is still valid after a reload
  await page.reload();
  await expect(page.locator("aside").getByText(newEmail)).toBeVisible();

  // The old address no longer signs in, the new one does
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();

  await page.locator("#login-email").fill(newEmail);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
});

test("a wrong current password is refused and nothing changes", async ({ page }) => {
  const user = await registerFreshUser(page);
  await openAccount(page);

  await submitEmailChange(page, uniqueUser().email, "not-my-password");

  await expect(page.getByText("Mot de passe actuel incorrect")).toBeVisible();
  await expect(page).toHaveURL(/\/account/); // a 401 would have signed the user out
  await expect(page.getByRole("main").getByText(user.email, { exact: true })).toBeVisible();
});

test("an address typed differently the second time is refused before anything is sent", async ({ page }) => {
  const user = await registerFreshUser(page);
  await openAccount(page);

  await submitEmailChange(page, uniqueUser().email, user.password, uniqueUser().email);

  await expect(page.getByText("Les adresses email ne correspondent pas")).toBeVisible();
  await expect(page.getByRole("main").getByText(user.email, { exact: true })).toBeVisible();
});

test("the current address is refused as a new one", async ({ page }) => {
  const user = await registerFreshUser(page);
  await openAccount(page);

  await submitEmailChange(page, user.email, user.password);

  await expect(page.getByText("Le nouvel email est identique à l'actuel")).toBeVisible();
});

test("an address already used by someone else is refused", async ({ page }) => {
  const user = await registerFreshUser(page);
  const other = await createAccount();
  await openAccount(page);

  await submitEmailChange(page, other.user.email, user.password);

  await expect(page.getByText("Cet email est déjà utilisé")).toBeVisible();
  await expect(page.getByRole("main").getByText(user.email, { exact: true })).toBeVisible();
});

test("the change is recorded in the admin journal with the old and new address", async ({ page, browser }) => {
  const visitor = await browser.newContext({ baseURL: process.env.BASE_URL });
  const visitorPage = await visitor.newPage();
  const user = await registerFreshUser(visitorPage);
  const newEmail = uniqueUser().email;
  await openAccount(visitorPage);
  await submitEmailChange(visitorPage, newEmail, user.password);
  await expect(visitorPage.getByText("Email mis à jour")).toBeVisible();
  await visitor.close();

  const admin = await registerFreshAdmin(page);
  await expect
    .poll(async () => (await apiCall("GET", `/admin/logs?type=email_changed&q=${encodeURIComponent(newEmail)}`, admin.token)).total)
    .toBe(1);

  await page.getByRole("link", { name: "Administration" }).click();
  await page.getByRole("tab", { name: "Journaux" }).click();
  await page.getByLabel("Filtrer par type").selectOption({ label: "Email modifié" });
  await page.getByLabel("Rechercher dans le journal").fill(newEmail);
  const row = page.getByTestId("log-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Email modifié");
  await row.click();
  await expect(page.getByTestId("log-details")).toContainText(user.email); // from
  await expect(page.getByTestId("log-details")).toContainText(newEmail); // to
  await expect(page.getByText(user.password)).toHaveCount(0);
});
