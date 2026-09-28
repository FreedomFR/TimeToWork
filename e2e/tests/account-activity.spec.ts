import { test, expect, Page } from "@playwright/test";
import { apiCall, createAccount, makeAdmin, registerFreshAdmin, registerViaUi, uniqueUser } from "./helpers";

/** The admin journal records who signs up, signs in and out, and asks for a password. */

const API = process.env.API_URL || "http://backend:4000";

async function openJournalFor(page: Page, email: string) {
  await page.getByRole("link", { name: "Administration" }).click();
  await page.getByRole("tab", { name: "Journaux" }).click();
  await page.getByLabel("Rechercher dans le journal").fill(email);
}

test("sign-up, sign-out and sign-in through the app appear in the journal with the address and browser", async ({ page, browser }) => {
  // A visitor signs up, signs out and signs back in, in their own browser window
  const visitor = await browser.newContext({ baseURL: process.env.BASE_URL });
  const visitorPage = await visitor.newPage();
  const user = uniqueUser();
  await registerViaUi(visitorPage, user);
  await visitorPage.getByRole("button", { name: "Déconnexion" }).click();
  await expect(visitorPage).toHaveURL(/\/login/);
  await visitorPage.locator("#login-email").fill(user.email);
  await visitorPage.locator("#login-password").fill(user.password);
  await visitorPage.getByRole("button", { name: "Se connecter" }).click();
  await expect(visitorPage.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  await visitor.close();

  // An admin reads it (through the API first: the sign-out is reported asynchronously)
  const admin = await registerFreshAdmin(page);
  await expect
    .poll(async () => {
      const res = await apiCall("GET", `/admin/logs?q=${encodeURIComponent(user.email)}`, admin.token);
      return res.items.map((i: { type: string }) => i.type).sort();
    })
    .toEqual(["account_created", "login", "logout"]);

  await page.goto("/");
  await openJournalFor(page, user.email);
  const rows = page.getByTestId("log-row");
  await expect(rows).toHaveCount(3);
  // Newest first: signed in, signed out, created
  await expect(rows.nth(0)).toContainText("Connexion");
  await expect(rows.nth(1)).toContainText("Déconnexion");
  await expect(rows.nth(2)).toContainText("Compte créé");
  for (const i of [0, 1, 2]) await expect(rows.nth(i)).toContainText(user.email);
  await expect(rows.nth(2)).toContainText("POST /api/auth/register → 201");

  // The information used: address and browser (and the name given at sign-up), never the password
  await rows.nth(2).click();
  const info = page.getByTestId("log-client-info");
  await expect(info).toContainText("Adresse IP");
  await expect(info).toContainText("Navigateur");
  await expect(info).toContainText("Mozilla/5.0");
  await expect(page.getByTestId("log-details")).toContainText(user.name);
  await expect(page.getByText(user.password)).toHaveCount(0);
});

test("the account activity types can be filtered on", async ({ page }) => {
  const admin = await registerFreshAdmin(page);
  const account = await createAccount(); // journals "Compte créé"
  await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.user.email, password: account.user.password }),
  });
  await expect
    .poll(async () => (await apiCall("GET", `/admin/logs?q=${encodeURIComponent(account.user.email)}`, admin.token)).total)
    .toBe(2);

  await page.goto("/");
  await openJournalFor(page, account.user.email);
  await expect(page.getByTestId("log-row")).toHaveCount(2);

  const counters = page.getByRole("group", { name: "Répartition par type" });
  await expect(counters.getByRole("button", { name: /Compte créé/ })).toContainText("1");
  await expect(counters.getByRole("button", { name: /^Connexion/ })).toContainText("1");

  await counters.getByRole("button", { name: /Compte créé/ }).click();
  await expect(page.getByTestId("log-row")).toHaveCount(1);
  await expect(page.getByTestId("log-row")).toContainText("Compte créé");
  await expect(page.getByLabel("Filtrer par type")).toHaveValue("account_created");
});

test("a password reset request is journaled, whether or not the account exists, and the visitor learns nothing", async ({ page }) => {
  const admin = await registerFreshAdmin(page);
  const account = await createAccount();
  const ghost = `nobody-${Date.now()}@example.com`;
  const ask = async (email: string) =>
    (
      await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    ).json();

  expect(await ask(account.user.email)).toEqual(await ask(ghost)); // same answer for both
  await expect
    .poll(async () => (await apiCall("GET", `/admin/logs?type=password_reset_requested&q=${encodeURIComponent(ghost)}`, admin.token)).total)
    .toBe(1);

  await page.goto("/");
  await openJournalFor(page, "nobody-");
  await page.getByLabel("Filtrer par type").selectOption({ label: "Demande de réinitialisation" });
  await page.getByLabel("Rechercher dans le journal").fill(ghost);
  const row = page.getByTestId("log-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("compte inexistant");
  await expect(row).toContainText("Avertissement");
});

test("a sign-up refused because the email is taken is journaled", async ({ page }) => {
  const admin = await registerFreshAdmin(page);
  const account = await createAccount();
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.user.email, password: "another-password-1", name: "Impostor" }),
  });
  expect(res.status).toBe(409);
  await makeAdmin(admin.id);

  await expect
    .poll(async () => (await apiCall("GET", `/admin/logs?type=auth_failed&q=${encodeURIComponent(account.user.email)}`, admin.token)).total)
    .toBe(1);

  await page.goto("/");
  await openJournalFor(page, account.user.email);
  await page.getByLabel("Filtrer par type").selectOption({ label: "Échec d'authentification" });
  // Wait for the search (typed a moment ago) to narrow the list down before reading it
  await expect(page.getByTestId("log-row")).toHaveCount(1);
  await expect(page.getByTestId("log-row")).toContainText("Inscription refusée");
});
