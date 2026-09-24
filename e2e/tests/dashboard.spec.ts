import { test, expect, Page } from "@playwright/test";
import { registerAndLogin } from "./helpers";

async function addManualEntry(page: Page, description: string, start: string, end: string, project?: string) {
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill(description);
  if (project) {
    await page.getByRole("button", { name: "Projet" }).click();
    await page.getByText(project, { exact: true }).click();
  }
  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill(start);
  await startInput.blur();
  const endInput = page.getByLabel("Heure de fin");
  await endInput.click();
  await endInput.fill(end);
  await endInput.blur();
  await page.getByRole("button", { name: "AJOUTER" }).click();
  await expect(page.getByPlaceholder("Sur quoi avez-vous travaillé ?")).toHaveValue("");
}

async function openDashboard(page: Page) {
  await page.getByRole("link", { name: "Tableau de bord" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
}

test("dashboard is reachable from the sidebar and empty for a new account", async ({ page }) => {
  await registerAndLogin(page);
  await openDashboard(page);

  await expect(page.getByTestId("kpi-total")).toHaveText("00:00:00");
  await expect(page.getByTestId("kpi-project")).toHaveText("—");
  await expect(page.getByTestId("kpi-client")).toHaveText("—");
  await expect(page.getByText("Aucune activité pour cette période")).toBeVisible();
  await expect(page.getByText("Aucune donnée pour cette période")).toBeVisible();

  // Default period is the current week: one bar slot per day, Monday to Sunday
  await expect(page.getByTestId("dashboard-bar-chart").locator("[title*=' : 00:00:00']")).toHaveCount(7);
});

test("dashboard shows totals, top project/client, breakdown and most tracked activities", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByPlaceholder("Nom du client").fill("Acme Corp");
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await expect(page.getByText("Acme Corp")).toBeVisible();

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Alpha");
  await page.getByRole("combobox").selectOption({ label: "Acme Corp" });
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await expect(page.getByText("Alpha")).toBeVisible();

  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await addManualEntry(page, "Dev API", "0800", "1000", "Alpha");
  await addManualEntry(page, "Dev API", "1000", "1100", "Alpha");
  await addManualEntry(page, "Réunion", "1100", "1200");

  await openDashboard(page);

  await expect(page.getByTestId("kpi-total")).toHaveText("04:00:00");
  await expect(page.getByTestId("kpi-project")).toHaveText("Alpha");
  await expect(page.getByTestId("kpi-client")).toHaveText("Acme Corp");

  // Today's bar carries the whole 4h
  await expect(page.getByTestId("dashboard-bar-chart").locator("[title$=' : 04:00:00']")).toHaveCount(1);

  // Breakdown by project with percentages
  const shares = page.getByRole("list", { name: "Répartition par projet" }).getByRole("listitem");
  await expect(shares).toHaveCount(2);
  await expect(shares.nth(0)).toContainText("Alpha - Acme Corp");
  await expect(shares.nth(0)).toContainText("03:00:00");
  await expect(shares.nth(0)).toContainText("75,00%");
  await expect(shares.nth(1)).toContainText("Aucun projet");
  await expect(shares.nth(1)).toContainText("25,00%");

  // The two "Dev API" entries are merged into one activity, ranked first
  const activities = page.getByRole("list", { name: "Activités les plus suivies" }).getByRole("listitem");
  await expect(activities).toHaveCount(2);
  await expect(activities.nth(0)).toContainText("Dev API");
  await expect(activities.nth(0)).toContainText("Alpha - Acme Corp");
  await expect(activities.nth(0)).toContainText("03:00:00");
  await expect(activities.nth(1)).toContainText("Réunion");
  await expect(activities.nth(1)).toContainText("01:00:00");
});

test("dashboard period navigation and custom range", async ({ page }) => {
  await registerAndLogin(page);
  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await addManualEntry(page, "Cette semaine", "0800", "0900");
  await openDashboard(page);
  await expect(page.getByTestId("kpi-total")).toHaveText("01:00:00");

  await page.getByTitle("Période précédente").click();
  await expect(page.getByTestId("kpi-total")).toHaveText("00:00:00");
  await page.getByTitle("Période suivante").click();
  await expect(page.getByTestId("kpi-total")).toHaveText("01:00:00");

  // Whole year: bars switch to one per month
  await page.getByTitle("Choisir une période").click();
  await page.getByRole("button", { name: "Cette année" }).click();
  await expect(page.getByTestId("kpi-total")).toHaveText("01:00:00");
  await expect(page.getByTestId("dashboard-bar-chart").locator("[title*=' : ']")).toHaveCount(12);

  // Custom range far in the past has nothing
  await page.getByTitle("Choisir une période").click();
  await page.getByRole("button", { name: "Plage personnalisée..." }).click();
  await page.getByText("Du", { exact: true }).locator("xpath=following-sibling::input").fill("2020-01-01");
  await page.getByText("Au", { exact: true }).locator("xpath=following-sibling::input").fill("2020-01-10");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByTestId("kpi-total")).toHaveText("00:00:00");
  await expect(page.getByTestId("dashboard-bar-chart").locator("[title*=' : ']")).toHaveCount(10);
});

test("dashboard limits the most tracked activities list", async ({ page }) => {
  await registerAndLogin(page);
  await page.getByRole("link", { name: "Suivi du temps" }).click();
  for (let i = 1; i <= 6; i++) {
    await addManualEntry(page, `Activité ${i}`, `0${i}00`, `0${i}30`);
  }
  await openDashboard(page);

  const activities = page.getByRole("list", { name: "Activités les plus suivies" }).getByRole("listitem");
  await expect(activities).toHaveCount(6);

  await page.getByLabel("Nombre d'activités").selectOption("5");
  await expect(activities).toHaveCount(5);
});
