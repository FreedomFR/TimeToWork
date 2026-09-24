import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("selects a custom date range from the period picker", async ({ page }) => {
  await registerAndLogin(page);
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Ancienne tâche");
  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill("0800");
  await startInput.blur();
  const endInput = page.getByLabel("Heure de fin");
  await endInput.click();
  await endInput.fill("0900");
  await endInput.blur();
  await page.getByRole("button", { name: "AJOUTER" }).click();

  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByTitle("Choisir une période").click();
  await page.getByText("Plage personnalisée...").click();

  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.first().fill("2020-01-01");
  await dateInputs.last().fill("2020-01-31");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();

  await expect(page.getByTitle("Choisir une période")).toContainText("1 janv - 31 janv 2020");
  await expect(page.getByText("Aucune donnée pour cette période").first()).toBeVisible();

  await expect(page.getByTitle("Période précédente")).toBeDisabled();
  await expect(page.getByTitle("Période suivante")).toBeDisabled();

  await page.getByTitle("Choisir une période").click();
  await page.getByText("Ce mois-ci", { exact: true }).click();

  // Grouped by project, the entry shows up as "Aucun projet" (no project assigned)
  // rather than by its own description — switch grouping to see the description itself.
  await expect(page.getByText("01:00:00").first()).toBeVisible();
  await page.getByRole("button", { name: "Description" }).last().click();
  await expect(page.getByText("Ancienne tâche")).toBeVisible();
  await expect(page.getByTitle("Période précédente")).toBeEnabled();
});
