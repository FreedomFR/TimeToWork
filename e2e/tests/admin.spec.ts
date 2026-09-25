import { test, expect, Page } from "@playwright/test";
import { apiCall, createAccount, makeAdmin, registerAndLogin, registerFreshAdmin } from "./helpers";

/**
 * Admin role and journal. Admins are made by writing to the database (as scripts/set-admin.ts
 * does for the first one); everything after that goes through the app.
 */

async function openAdmin(page: Page) {
  await page.getByRole("link", { name: "Administration" }).click();
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
}

const userRow = (page: Page, email: string) => page.getByTestId("admin-user-row").filter({ hasText: email });

async function searchUser(page: Page, email: string) {
  await page.getByLabel("Rechercher un utilisateur").fill(email);
  await expect(page.getByTestId("admin-user-row")).toHaveCount(1);
}

async function confirmRoleChange(page: Page, title: "Promouvoir administrateur" | "Retirer le rôle administrateur") {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmer" }).click();
  await expect(dialog).toHaveCount(0);
}

test("a regular user has no way into the administration", async ({ page }) => {
  await registerAndLogin(page);

  await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  await expect(page).not.toHaveURL(/\/admin/);
});

test("an admin sees the administration and is listed with the admin role", async ({ page }) => {
  const admin = await registerFreshAdmin(page);
  await openAdmin(page);

  const row = userRow(page, admin.user.email);
  await expect(row).toContainText("Administrateur");
  await expect(row).toContainText("(vous)");
  await expect(page.getByRole("tab", { name: "Utilisateurs" })).toHaveAttribute("aria-selected", "true");
});

test("an admin promotes another user, who gets access at once, then takes the role away", async ({ page }) => {
  await registerFreshAdmin(page);
  const other = await createAccount();
  await openAdmin(page);
  await searchUser(page, other.user.email);

  const row = userRow(page, other.user.email);
  await expect(row).toContainText("Utilisateur");
  expect((await fetch(`${process.env.API_URL || "http://backend:4000"}/api/admin/users`, { headers: { Authorization: `Bearer ${other.token}` } })).status).toBe(403);

  await row.getByRole("button", { name: "Promouvoir administrateur" }).click();
  await confirmRoleChange(page, "Promouvoir administrateur");
  await expect(row).toContainText("Administrateur");
  // The other user's existing session now works on admin routes
  expect((await apiCall("GET", "/admin/users", other.token)).length).toBeGreaterThan(0);

  await row.getByRole("button", { name: "Retirer le rôle admin" }).click();
  await confirmRoleChange(page, "Retirer le rôle administrateur");
  await expect(row).toContainText("Utilisateur");
  await expect(apiCall("GET", "/admin/users", other.token)).rejects.toThrow(/403/);
});

test("cancelling the confirmation changes nothing", async ({ page }) => {
  await registerFreshAdmin(page);
  const other = await createAccount();
  await openAdmin(page);
  await searchUser(page, other.user.email);

  await userRow(page, other.user.email).getByRole("button", { name: "Promouvoir administrateur" }).click();
  await page.getByRole("dialog", { name: "Promouvoir administrateur" }).getByRole("button", { name: "Annuler" }).click();

  await expect(userRow(page, other.user.email)).toContainText("Utilisateur");
  await expect(apiCall("GET", "/admin/users", other.token)).rejects.toThrow(/403/);
});

test("an admin who steps down loses the administration right away", async ({ page }) => {
  const admin = await registerFreshAdmin(page);
  const successor = await createAccount();
  await makeAdmin(successor.id); // another admin exists, so stepping down is allowed
  await openAdmin(page);
  await searchUser(page, admin.user.email);

  await userRow(page, admin.user.email).getByRole("button", { name: "Retirer le rôle admin" }).click();
  await expect(page.getByRole("dialog")).toContainText("Vous perdrez l'accès à cette page");
  await confirmRoleChange(page, "Retirer le rôle administrateur");

  // Sent back to the app, and the menu entry is gone
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);
});

// ─── Journal ───────────────────────────────────────────────────────────────

/** Makes the server journal a "validation_error" for this account (the API refuses the data). */
async function provokeValidationError(token: string) {
  await fetch(`${process.env.API_URL || "http://backend:4000"}/api/time-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ start: "not-a-date" }),
  });
}

/** Makes the server journal an "auth_failed" for this account (wrong password). */
async function provokeFailedLogin(email: string) {
  await fetch(`${process.env.API_URL || "http://backend:4000"}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "definitely-wrong-password" }),
  });
}

async function openLogsFor(page: Page, email: string) {
  await openAdmin(page);
  await page.getByRole("tab", { name: "Journaux" }).click();
  await page.getByLabel("Rechercher dans le journal").fill(email);
}

test("the journal shows what happened, filterable by person and type of bug", async ({ page }) => {
  await registerFreshAdmin(page);
  const victim = await createAccount();
  const bystander = await createAccount();
  await provokeValidationError(victim.token);
  await provokeFailedLogin(victim.user.email);
  await provokeValidationError(bystander.token);

  await openAdmin(page);
  await page.getByRole("tab", { name: "Journaux" }).click();

  // By person
  await page.getByLabel("Filtrer par personne").selectOption({ label: `${victim.user.name} (${victim.user.email})` });
  await expect(page.getByTestId("log-row")).toHaveCount(2);
  await expect(page.getByTestId("log-row").filter({ hasText: bystander.user.email })).toHaveCount(0);

  // By type of bug
  await page.getByLabel("Filtrer par type").selectOption({ label: "Échec d'authentification" });
  await expect(page.getByTestId("log-row")).toHaveCount(1);
  await expect(page.getByTestId("log-row")).toContainText("Mot de passe incorrect");
  await expect(page.getByTestId("log-row")).toContainText("POST /api/auth/login → 401");

  await page.getByLabel("Filtrer par type").selectOption({ label: "Données invalides" });
  await expect(page.getByTestId("log-row")).toHaveCount(1);
  await expect(page.getByTestId("log-row")).toContainText("POST /api/time-entries → 400");

  // A line expands to its details: which field was refused, never the value
  await page.getByTestId("log-row").click();
  await expect(page.getByTestId("log-details")).toContainText("start");

  // By level
  await page.getByLabel("Filtrer par type").selectOption({ label: "Tous" });
  await page.getByLabel("Filtrer par niveau").selectOption({ label: "Avertissement" });
  await expect(page.getByTestId("log-row")).toHaveCount(1); // the failed login is a warning, the validation error is info

  // Reset
  await page.getByRole("button", { name: "Réinitialiser" }).click();
  await expect(page.getByLabel("Filtrer par personne")).toHaveValue("");
});

test("the type counters show how many of each and filter on click", async ({ page }) => {
  await registerFreshAdmin(page);
  const victim = await createAccount();
  await provokeValidationError(victim.token);
  await provokeValidationError(victim.token);
  await provokeFailedLogin(victim.user.email);

  await openLogsFor(page, victim.user.email);
  const counters = page.getByRole("group", { name: "Répartition par type" });
  await expect(counters.getByRole("button", { name: /Données invalides/ })).toContainText("2");
  await expect(counters.getByRole("button", { name: /Échec d'authentification/ })).toContainText("1");
  await expect(counters.getByRole("button", { name: /Erreur serveur/ })).toContainText("0");

  await counters.getByRole("button", { name: /Données invalides/ }).click();
  await expect(page.getByTestId("log-row")).toHaveCount(2);
  await expect(counters.getByRole("button", { name: /Données invalides/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Filtrer par type")).toHaveValue("validation_error");

  // Clicking again removes the filter
  await counters.getByRole("button", { name: /Données invalides/ }).click();
  await expect(page.getByTestId("log-row")).toHaveCount(3);
});

test("the journal can be sorted by column, in both directions", async ({ page }) => {
  await registerFreshAdmin(page);
  const victim = await createAccount();
  await provokeValidationError(victim.token);
  await provokeFailedLogin(victim.user.email);

  await openLogsFor(page, victim.user.email);
  await expect(page.getByTestId("log-row")).toHaveCount(2);

  const type = page.getByRole("columnheader", { name: "TYPE" });
  const date = page.getByRole("columnheader", { name: "DATE" });
  await expect(date).toHaveAttribute("aria-sort", "descending"); // default: newest first
  await expect(page.getByTestId("log-row").first()).toContainText("Échec d'authentification"); // logged last

  await date.getByRole("button").click();
  await expect(date).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByTestId("log-row").first()).toContainText("Données invalides");

  await type.getByRole("button").click();
  await expect(type).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByTestId("log-row").first()).toContainText("Échec d'authentification"); // auth_failed < validation_error
  await type.getByRole("button").click();
  await expect(type).toHaveAttribute("aria-sort", "descending");
  await expect(page.getByTestId("log-row").first()).toContainText("Données invalides");
});

test("the journal is paginated", async ({ page }) => {
  await registerFreshAdmin(page);
  const victim = await createAccount();
  for (let i = 0; i < 27; i++) await provokeValidationError(victim.token);

  await openLogsFor(page, victim.user.email);
  await expect(page.getByText("27 entrée(s) · page 1 / 2")).toBeVisible();
  await expect(page.getByTestId("log-row")).toHaveCount(25);
  await expect(page.getByRole("button", { name: "Précédent" })).toBeDisabled();

  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("27 entrée(s) · page 2 / 2")).toBeVisible();
  await expect(page.getByTestId("log-row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Suivant" })).toBeDisabled();

  await page.getByLabel("Par page").selectOption("50");
  await expect(page.getByText("27 entrée(s) · page 1 / 1")).toBeVisible();
  await expect(page.getByTestId("log-row")).toHaveCount(27);
});

test("a JavaScript error on a user's screen ends up in the journal, shown as plain text", async ({ page }) => {
  // The user hits a bug (with a hostile message, to check it is never interpreted)
  const user = await registerAndLogin(page);
  const message = `E2E boom ${Date.now()} <img src=x onerror="window.__xss=1">`;
  await page.evaluate((m) => setTimeout(() => { throw new Error(m); }), message);

  // An admin looks it up through the API first (reporting is asynchronous), then on screen
  const adminAccount = await createAccount();
  await makeAdmin(adminAccount.id);
  await expect
    .poll(async () => {
      const res = await apiCall("GET", `/admin/logs?type=client_error&q=${encodeURIComponent(message.slice(0, 30))}`, adminAccount.token);
      return res.total;
    })
    .toBe(1);

  await page.context().clearCookies();
  await page.evaluate((t) => localStorage.setItem("token", t), adminAccount.token);
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Journaux" }).click();
  await page.getByLabel("Filtrer par type").selectOption({ label: "Erreur navigateur" });
  await page.getByLabel("Rechercher dans le journal").fill(message.slice(0, 30));

  const row = page.getByTestId("log-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(user.email);
  await expect(row).toContainText(`<img src=x onerror="window.__xss=1">`); // displayed as text
  await row.click();
  await expect(page.getByTestId("log-details")).toContainText("Error");
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test("role changes are recorded in the journal as admin actions", async ({ page }) => {
  const admin = await registerFreshAdmin(page);
  const other = await createAccount();
  await openAdmin(page);
  await searchUser(page, other.user.email);
  await userRow(page, other.user.email).getByRole("button", { name: "Promouvoir administrateur" }).click();
  await confirmRoleChange(page, "Promouvoir administrateur");

  await page.getByRole("tab", { name: "Journaux" }).click();
  await page.getByLabel("Filtrer par type").selectOption({ label: "Action d'administration" });
  await page.getByLabel("Rechercher dans le journal").fill(other.user.email);

  const row = page.getByTestId("log-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(admin.user.email); // who did it
  await expect(row).toContainText("USER → ADMIN");
});
