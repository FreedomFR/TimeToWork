import { test, expect } from "@playwright/test";
import { registerAndLogin, uniqueUser } from "./helpers";

test("registers a new account and lands on the time tracker", async ({ page }) => {
  const user = await registerAndLogin(page);
  await expect(page.getByText(user.name)).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
});

test("logs out and back in with the same credentials", async ({ page }) => {
  const user = await registerAndLogin(page);

  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
});

test("rejects a wrong password with an error message", async ({ page }) => {
  const user = await registerAndLogin(page);
  await page.getByRole("button", { name: "Déconnexion" }).click();

  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill("totally-wrong-password");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("rejects registering with an email already in use", async ({ page }) => {
  const user = uniqueUser();
  await registerAndLogin(page, user);
  await page.getByRole("button", { name: "Déconnexion" }).click();

  await page.goto("/register");
  await page.locator("#register-name").fill("Someone else");
  await page.locator("#register-email").fill(user.email);
  await page.locator("#register-password").fill("another-password");
  await page.getByRole("button", { name: "Créer le compte" }).click();

  await expect(page.getByText("Cet email est déjà utilisé")).toBeVisible();
});

test("redirects an unauthenticated visitor away from the app to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("forgot-password shows a confirmation message without revealing whether the account exists", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);

  await page.locator('input[type="email"]').fill("someone-not-registered@example.com");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();

  await expect(
    page.getByText("Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.")
  ).toBeVisible();
});
