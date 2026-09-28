import { test, expect, Page } from "@playwright/test";
import { apiCall, makeAdmin, resetAccountData, runSql } from "../tests/helpers";

/**
 * Generates the screenshots of docs/GUIDE.md (run with `npm run docs:screenshots`, see docs.config.ts).
 *
 * It works on made-up "demo" accounts (emails start with `e2e_docs_`, so the usual E2E cleanup
 * script removes them), never on real ones, and hides anything that could show real people:
 * the login page's DEV quick-login list is blocked, and the admin lists are filtered on the demo emails.
 */

const API = process.env.API_URL || "http://backend:4000";
const OUT = process.env.SCREENSHOT_DIR || "/screenshots";
const PASSWORD = "demo-password-1";
const DAY = 24 * 60 * 60 * 1000;

interface Demo {
  id: string;
  token: string;
  email: string;
  name: string;
}

async function shot(page: Page, name: string) {
  // Let animations and pending requests settle so nothing is captured half-drawn
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

/** Creates the demo account, or signs in and empties it when it already exists from a previous run. */
async function demoAccount(name: string, slug: string): Promise<Demo> {
  const email = `e2e_docs_${slug}@example.com`;
  let session: { token: string; user: { id: string } };
  try {
    session = await apiCall("POST", "/auth/register", undefined, { email, password: PASSWORD, name });
  } catch {
    session = await apiCall("POST", "/auth/login", undefined, { email, password: PASSWORD });
  }
  await resetAccountData(session.token);
  // Back to a plain user (a previous run may have promoted this account) and no old journal lines
  await runSql(`UPDATE "User" SET role = 'USER' WHERE id = $1`, [session.user.id]);
  await runSql(`DELETE FROM "LogEntry" WHERE "userId" = $1 OR "userEmail" = $2`, [session.user.id, email]);
  return { id: session.user.id, token: session.token, email, name };
}

async function signIn(page: Page, token: string, path = "/") {
  await page.goto("/login");
  await page.evaluate((t) => localStorage.setItem("token", t), token);
  await page.goto(path);
}

/** Monday 00:00 (UTC, like the browser in the test container) of the week containing `date`. */
function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

const at = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getTime() + (h * 60 + m) * 60 * 1000).toISOString();
};

async function seedDemoData(demo: Demo) {
  const t = demo.token;
  const acme = await apiCall("POST", "/clients", t, { name: "Acme Corp" });
  const globex = await apiCall("POST", "/clients", t, { name: "Globex" });
  const refonte = await apiCall("POST", "/projects", t, { name: "Refonte site web", color: "#03A9F4", clientId: acme.id });
  const mobile = await apiCall("POST", "/projects", t, { name: "Application mobile", color: "#E91E63", clientId: acme.id });
  const support = await apiCall("POST", "/projects", t, { name: "Support client", color: "#4CAF50", clientId: globex.id });
  const interne = await apiCall("POST", "/projects", t, { name: "Interne", color: "#FF9800" });
  const dev = await apiCall("POST", "/tags", t, { name: "dev" });
  const reunion = await apiCall("POST", "/tags", t, { name: "réunion" });
  const urgent = await apiCall("POST", "/tags", t, { name: "urgent" });

  const entry = (day: Date, start: string, end: string, description: string, project: { id: string }, tags: { id: string }[] = [], billable = true) =>
    apiCall("POST", "/time-entries", t, {
      description,
      projectId: project.id,
      tagIds: tags.map((x) => x.id),
      billable,
      start: at(day, start),
      end: at(day, end),
    });

  // Last week: a full, varied week (Monday to Friday)
  const lastMonday = new Date(mondayOf(new Date()).getTime() - 7 * DAY);
  const week: [number, string, string, string, { id: string }, { id: string }[], boolean?][] = [
    [0, "09:00", "10:00", "Point d'équipe", interne, [reunion], false],
    [0, "10:00", "12:30", "Refonte site web — intégration de la maquette", refonte, [dev]],
    [0, "14:00", "17:30", "Application mobile — écran de connexion", mobile, [dev]],
    [1, "09:00", "11:00", "Réunion de cadrage client", refonte, [reunion]],
    [1, "11:00", "12:30", "Support client — ticket #1287 : export PDF", support, [urgent]],
    [1, "14:00", "18:00", "Refonte site web — intégration de la maquette", refonte, [dev]],
    [2, "08:30", "12:00", "Application mobile — écran de connexion", mobile, [dev]],
    [2, "13:30", "15:00", "Revue de code", mobile, [dev]],
    [2, "15:00", "17:00", "Rédaction de la documentation", interne, [], false],
    [3, "09:30", "12:00", "Refonte site web — page d'accueil", refonte, [dev]],
    [3, "14:00", "16:00", "Support client — ticket #1301 : accès refusé", support, [urgent]],
    [4, "09:00", "12:30", "Application mobile — synchronisation hors ligne", mobile, [dev]],
    [4, "14:00", "15:30", "Point d'équipe", interne, [reunion], false],
  ];
  for (const [d, s, e, desc, project, tags, billable] of week) {
    await entry(new Date(lastMonday.getTime() + d * DAY), s, e, desc, project, tags, billable);
  }

  // Today: one mission cut into pieces (to show grouping and merging) and a single entry
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const mission = "Support client — ticket #1287 : export PDF";
  await entry(today, "07:50", "08:45", mission, support, [urgent]);
  await entry(today, "08:45", "10:00", mission, support, [urgent]);
  await entry(today, "10:00", "12:00", mission, support, [urgent]);
  await entry(today, "13:30", "14:00", mission, support, [urgent]);
  await entry(today, "14:25", "16:30", "Refonte site web — page d'accueil", refonte, [dev]);
}

/** A page-wide check that the app is showing the signed-in area. */
const trackerReady = (page: Page) => expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();

/** The clickable summary line of an entry (or group) showing the given time range. */
const lineWith = (page: Page, timeRange: string) =>
  page.getByText(timeRange, { exact: true }).locator("xpath=ancestor::div[contains(@class,'cursor-pointer')][1]");

test.describe.configure({ mode: "serial" });

test("documentation screenshots", async ({ page }) => {
  // ── Signed-out pages ─────────────────────────────────────────────────────
  // The DEV quick-login list would show every real account: pretend the mode is off
  await page.route("**/api/auth/dev/users", (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await shot(page, "login");

  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Créer le compte" })).toBeVisible();
  await shot(page, "register");

  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: "Envoyer le lien" })).toBeVisible();
  await shot(page, "forgot-password");

  // ── Demo data ───────────────────────────────────────────────────────────
  const camille = await demoAccount("Camille Martin", "camille");
  await seedDemoData(camille);
  await signIn(page, camille.token);
  await trackerReady(page);

  // ── Time tracker ────────────────────────────────────────────────────────
  await expect(page.getByText("Total semaine").first()).toBeVisible();
  await shot(page, "tracker");

  // Recent tasks proposed when the description field gets focus
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").click();
  await expect(page.getByText("Tâches récentes")).toBeVisible();
  await shot(page, "tracker-suggestions");
  await page.getByRole("heading", { name: "Suivi du temps" }).click();

  // Project and tag pickers
  await page.getByRole("button", { name: "Projet" }).click();
  await expect(page.getByText("Application mobile").first()).toBeVisible();
  await shot(page, "tracker-project-picker");
  await page.getByRole("heading", { name: "Suivi du temps" }).click();

  // A group of identical entries, opened, with the merge menu
  await page.getByText("Support client — ticket #1287 : export PDF").first().click();
  await expect(page.getByText("10:00 - 12:00", { exact: true })).toBeVisible();
  await lineWith(page, "10:00 - 12:00").getByTitle("Plus d'options").click();
  await expect(page.getByRole("button", { name: "Fusionner avec le créneau précédent" })).toBeVisible();
  await shot(page, "tracker-merge");
  await page.getByRole("heading", { name: "Suivi du temps" }).click();
  await page.getByText("Support client — ticket #1287 : export PDF").first().click(); // close the group

  // Inline editing of a single entry
  await lineWith(page, "14:25 - 16:30").click();
  await expect(page.getByPlaceholder("Description")).toBeVisible();
  await shot(page, "tracker-edit");
  await lineWith(page, "14:25 - 16:30").click();

  // Timer mode, with a running timer
  await page.getByTitle("Passer au minuteur").click();
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Rédaction du compte rendu de réunion");
  await page.getByRole("button", { name: "Projet" }).click();
  await page.getByRole("button", { name: "Interne" }).click();
  await page.getByRole("button", { name: "DÉMARRER" }).click();
  await expect(page.getByRole("button", { name: "ARRÊTER" })).toBeVisible();
  await page.waitForTimeout(2200); // let the clock show a few seconds
  await shot(page, "tracker-timer");
  const running = await apiCall("GET", "/time-entries/current", camille.token);
  await page.getByRole("button", { name: "ARRÊTER" }).click();
  await expect(page.getByRole("button", { name: "DÉMARRER" })).toBeVisible();
  await apiCall("DELETE", `/time-entries/${running.id}`, camille.token); // keep the demo data as seeded

  // ── Calendar ────────────────────────────────────────────────────────────
  await page.getByRole("link", { name: "Calendrier" }).click();
  await expect(page.getByRole("button", { name: "Semaine", exact: true })).toBeVisible();
  await page.getByTitle("Période précédente").click();
  await expect(page.getByTestId("calendar-event").first()).toBeVisible();
  await shot(page, "calendar-week");

  await page.getByRole("button", { name: "Jour", exact: true }).click();
  await expect(page.getByTestId("calendar-event").first()).toBeVisible();
  await shot(page, "calendar-day");

  await page.getByTestId("calendar-event").first().click();
  const editDialog = page.getByRole("dialog", { name: "Modifier le créneau" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByTitle("Tags").click();
  await expect(editDialog.getByPlaceholder("Rechercher ou créer un tag")).toBeVisible();
  await shot(page, "calendar-edit");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // ── Dashboard ───────────────────────────────────────────────────────────
  await page.getByRole("link", { name: "Tableau de bord" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await page.getByTitle("Période précédente").click();
  await expect(page.getByTestId("kpi-total")).not.toHaveText("00:00:00");
  await shot(page, "dashboard");

  // ── Reports ─────────────────────────────────────────────────────────────
  await page.getByRole("link", { name: "Rapports" }).click();
  await expect(page.getByText("RAPPORT DE TEMPS")).toBeVisible();
  await shot(page, "reports-summary");

  await page.getByTitle("Choisir une période").click();
  await expect(page.getByRole("button", { name: "Plage personnalisée..." })).toBeVisible();
  await shot(page, "reports-period");
  await page.getByRole("button", { name: "Plage personnalisée..." }).click();
  await shot(page, "reports-custom-range");
  await page.getByText("RAPPORT DE TEMPS").click();

  await page.getByRole("button", { name: "Projet" }).first().click();
  await expect(page.locator("label").filter({ hasText: "Refonte site web" })).toBeVisible();
  await shot(page, "reports-filter");
  await page.getByText("RAPPORT DE TEMPS").click();

  await page.getByRole("button", { name: "Détaillé" }).click();
  await expect(page.getByText("UTILISATEUR")).toBeVisible();
  await shot(page, "reports-detailed");

  await page.getByRole("button", { name: "Hebdomadaire" }).click();
  await page.getByTitle("Période précédente").click();
  await expect(page.getByRole("table")).toBeVisible();
  await shot(page, "reports-weekly");

  await page.getByRole("button", { name: "EXPORTATION" }).click();
  await expect(page.getByRole("dialog", { name: "Exporter le rapport" })).toBeVisible();
  await shot(page, "reports-export");
  await page.getByRole("button", { name: "Annuler" }).click();

  // ── Projects and clients ────────────────────────────────────────────────
  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByText("Refonte site web", { exact: true }).first().click();
  await expect(page.getByPlaceholder("Nom du projet").last()).toBeVisible();
  await shot(page, "projects");

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByText("Acme Corp", { exact: true }).first().click();
  await shot(page, "clients");

  // ── Account ─────────────────────────────────────────────────────────────
  await page.getByRole("link", { name: "Mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Mon compte" })).toBeVisible();
  await shot(page, "account");

  // ── Administration (another demo account, promoted the way the first admin is) ──
  const alex = await demoAccount("Alex Admin", "alex");
  await makeAdmin(alex.id);
  const sam = await demoAccount("Sam Dupont", "sam");
  // Some events for the journal: wrong passwords, a refused access, a refused form, a browser error
  for (let i = 0; i < 2; i++) {
    await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: sam.email, password: "not-the-password" }),
    });
  }
  const asSam = (path: string, init: RequestInit) =>
    fetch(`${API}/api${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${sam.token}` } });
  await asSam("/admin/users", { method: "GET" }); // forbidden: Sam is not an admin
  await asSam("/time-entries", { method: "POST", body: JSON.stringify({ start: "pas-une-date" }) }); // refused by validation
  await asSam("/logs/client", {
    method: "POST",
    body: JSON.stringify({
      message: "Cannot read properties of undefined (reading 'map')",
      stack: "TypeError: Cannot read properties of undefined (reading 'map')\n    at Reports (assets/index.js:412:18)\n    at renderWithHooks (assets/index.js:1204:22)",
      url: "http://localhost:8080/reports",
      kind: "react",
    }),
  });

  await signIn(page, alex.token, "/admin");
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await page.getByLabel("Rechercher un utilisateur").fill("e2e_docs");
  await expect(page.getByTestId("admin-user-row")).toHaveCount(3);
  await shot(page, "admin-users");

  await page.getByTestId("admin-user-row").filter({ hasText: sam.email }).getByRole("button", { name: "Promouvoir administrateur" }).click();
  await expect(page.getByRole("dialog", { name: "Promouvoir administrateur" })).toBeVisible();
  await shot(page, "admin-promote");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByTestId("admin-user-row").filter({ hasText: sam.email })).toContainText("Administrateur");

  await page.getByRole("tab", { name: "Journaux" }).click();
  await page.getByLabel("Rechercher dans le journal").fill("e2e_docs");
  await expect(page.getByTestId("log-row").first()).toBeVisible();
  await shot(page, "admin-logs");

  await page.getByLabel("Filtrer par type").selectOption({ label: "Erreur navigateur" });
  await expect(page.getByTestId("log-row")).toHaveCount(1);
  await page.getByTestId("log-row").click();
  await expect(page.getByTestId("log-details")).toBeVisible();
  await shot(page, "admin-logs-details");
});
