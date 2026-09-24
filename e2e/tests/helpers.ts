import { Page, expect } from "@playwright/test";

let counter = 0;

export function uniqueUser() {
  counter += 1;
  const stamp = `${Date.now()}_${counter}`;
  return {
    name: `E2E User ${stamp}`,
    email: `e2e_${stamp}@example.com`,
    password: "password123",
  };
}

export async function registerAndLogin(page: Page, user = uniqueUser()) {
  await page.goto("/register");
  await page.locator("#register-name").fill(user.name);
  await page.locator("#register-email").fill(user.email);
  await page.locator("#register-password").fill(user.password);
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  return user;
}
