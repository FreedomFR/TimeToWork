import { test, expect, Page } from "@playwright/test";
import { registerViaUi, sharedUser, uniqueUser } from "./helpers";

/** Fills the login page with the given credentials and submits it. */
async function submitLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("registers a new account and lands on the time tracker", async ({ page }) => {
  const user = uniqueUser();
  await registerViaUi(page, user);
  await expect(page.getByText(user.name)).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
});

// The login tests reuse the account the `setup` project created through the register page
// (they only read it, so they are safe to run in parallel with the other tests)
test("logs in with the account created at setup, logs out and back in", async ({ page }) => {
  const user = sharedUser();
  await submitLogin(page, user.email, user.password);
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();

  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/login/);

  await submitLogin(page, user.email, user.password);
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
});

test("rejects a wrong password with an error message", async ({ page }) => {
  await submitLogin(page, sharedUser().email, "totally-wrong-password");

  await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("rejects registering with an email already in use", async ({ page }) => {
  await page.goto("/register");
  await page.locator("#register-name").fill("Someone else");
  await page.locator("#register-email").fill(sharedUser().email);
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
