import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

async function addManualEntry(
  page: import("@playwright/test").Page,
  description: string,
  start = "0800",
  end = "0900"
) {
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
}

test("reports UI: shows the résumé tab with chart, filters and grouped table", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Refonte site");
  await page.getByRole("button", { name: "+ Ajouter" }).click();

  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await addManualEntry(page, "Intégration", "0800", "1000");

  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Design");
  await page.getByRole("button", { name: "Projet" }).click();
  await page.getByText("Refonte site").click();
  await addManualEntry(page, "Design", "1000", "1100");

  await page.getByRole("link", { name: "Rapports" }).click();

  await expect(page.getByText("RAPPORT DE TEMPS")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ce mois-ci" })).toBeVisible();
  await expect(page.getByText("Total :")).toBeVisible();
  await expect(page.getByText("03:00:00").first()).toBeVisible();

  await expect(page.getByText("Aucun projet")).toBeVisible();
  await expect(page.getByText("Refonte site")).toBeVisible();
});

test("reports UI: filtering by project narrows the total and table", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Client A");
  await page.getByRole("button", { name: "+ Ajouter" }).click();

  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await addManualEntry(page, "Sans projet", "0800", "0900");
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Avec projet");
  await page.getByRole("button", { name: "Projet" }).click();
  await page.getByText("Client A").click();
  await addManualEntry(page, "Avec projet", "0900", "1100");

  await page.getByRole("link", { name: "Rapports" }).click();
  await expect(page.getByText("03:00:00").first()).toBeVisible();

  await page.getByRole("button", { name: "Projet" }).first().click();
  await page.locator("label").filter({ hasText: "Client A" }).click();
  await page.getByText("RAPPORT DE TEMPS").click();

  await expect(page.getByText("02:00:00").first()).toBeVisible();
  await expect(page.getByText("Sans projet")).not.toBeVisible();
});

test("reports UI: switches grouping, expands a row, and changes the period", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Tâche unique", "0800", "0930");

  await page.getByRole("link", { name: "Rapports" }).click();
  await expect(page.getByText("Aucun projet")).toBeVisible();

  await page.getByRole("button", { name: "Description" }).last().click();
  await expect(page.getByText("Tâche unique")).toHaveCount(1);

  await page.getByText("Tâche unique").click();
  await expect(page.getByText("Tâche unique")).toHaveCount(2);

  await page.getByRole("button", { name: "Ce mois-ci" }).click();
  await page.getByRole("button", { name: "Semaine dernière" }).click();
  await expect(page.getByText("Aucune donnée pour cette période").first()).toBeVisible();
});
