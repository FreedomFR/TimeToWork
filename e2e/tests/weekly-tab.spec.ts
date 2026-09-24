import { test, expect, Page } from "@playwright/test";
import { registerAndLogin } from "./helpers";

async function addManualEntry(page: Page, description: string, start: string, end: string) {
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill(description);
  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill(start);
  await startInput.blur();
  const endInput = page.getByLabel("Heure de fin");
  await endInput.click();
  await endInput.fill(end);
  await endInput.blur();
  await page.getByRole("button", { name: "AJOUTER" }).click();
  await expect(page.getByText(description)).toBeVisible();
}

async function openWeekly(page: Page) {
  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "Hebdomadaire" }).click();
}

test("weekly tab shows one Monday-Sunday week with a column per day and totals", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Tâche semaine", "0800", "0930");
  await addManualEntry(page, "Autre tâche", "1000", "1100");
  await openWeekly(page);

  // The picker shows the week as a date range, not "Ce mois-ci"
  await expect(page.getByTitle("Choisir une période")).toContainText(" - ");
  await expect(page.getByTitle("Choisir une période")).not.toContainText("Ce mois-ci");

  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveCount(9); // group + 7 days + total
  await expect(table.getByRole("columnheader").first()).toHaveText("Projet");

  const row = table.getByRole("row", { name: /Aucun projet/ });
  await expect(row).toContainText("02:30:00");
  await expect(row.getByText("—")).toHaveCount(6); // the six other days are empty

  const totalRow = table.getByRole("row", { name: /^Total :/ });
  await expect(totalRow).toContainText("02:30:00");
  await expect(page.getByText("Total :").first()).toBeVisible();
});

test("weekly tab navigates week by week", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Cette semaine seulement", "0800", "0900");
  await openWeekly(page);
  await expect(page.getByRole("table")).toBeVisible();

  await page.getByTitle("Période précédente").click();
  await expect(page.getByText("Aucune donnée pour cette période").first()).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  await page.getByTitle("Période suivante").click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row", { name: /Aucun projet/ })).toContainText("01:00:00");

  await page.getByTitle("Période suivante").click();
  await expect(page.getByText("Aucune donnée pour cette période").first()).toBeVisible();
});

test("weekly tab only offers week presets and no custom range", async ({ page }) => {
  await registerAndLogin(page);
  await openWeekly(page);

  await page.getByTitle("Choisir une période").click();
  await expect(page.getByRole("button", { name: "Cette semaine" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Semaine dernière" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ce mois-ci" })).toHaveCount(0);
  await expect(page.getByText("Plage personnalisée...")).toHaveCount(0);
});

test("weekly tab can group by client or description", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Regroupement A", "0800", "0900");
  await addManualEntry(page, "Regroupement B", "0900", "1030");
  await openWeekly(page);

  await page.getByLabel("Regrouper par").selectOption("description");
  await expect(page.getByRole("columnheader").first()).toHaveText("Description");
  await expect(page.getByRole("row", { name: /Regroupement A/ })).toContainText("01:00:00");
  await expect(page.getByRole("row", { name: /Regroupement B/ })).toContainText("01:30:00");

  await page.getByLabel("Regrouper par").selectOption("client");
  await expect(page.getByRole("columnheader").first()).toHaveText("Client");
  await expect(page.getByRole("row", { name: /Sans client/ })).toContainText("02:30:00");
});

test("weekly tab keeps the month period of the other tabs untouched", async ({ page }) => {
  await registerAndLogin(page);
  await openWeekly(page);
  await page.getByTitle("Période précédente").click();

  await page.getByRole("button", { name: "Résumé" }).click();
  await expect(page.getByTitle("Choisir une période")).toContainText("Ce mois-ci");
});

test("weekly tab applies the rounding toggle (clicking its label works)", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Arrondi test", "0800", "0812");
  await openWeekly(page);
  await expect(page.getByRole("row", { name: /Aucun projet/ })).toContainText("00:12:00");

  await page.getByText("Arrondi").click();
  await expect(page.getByRole("row", { name: /Aucun projet/ })).toContainText("00:15:00");
});
