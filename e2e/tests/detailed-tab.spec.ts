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

test("detailed tab lists individual entries with user, time and duration columns", async ({ page }) => {
  const user = await registerAndLogin(page);
  await addManualEntry(page, "Tâche détaillée", "0800", "0930");

  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "Détaillé" }).click();

  await expect(page.getByText("CRÉNEAU")).toBeVisible();
  await expect(page.getByText("Tâche détaillée")).toBeVisible();
  await expect(page.getByText(user.name).first()).toBeVisible();
  await expect(page.getByText("08:00 09:30")).toBeVisible();
  await expect(page.getByText("01:30:00").first()).toBeVisible();
});

test("adds a tag to an entry from the detailed tab", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Sans balise");

  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "Détaillé" }).click();

  await page.getByRole("button", { name: "Ajouter les balises" }).click();
  await page.getByPlaceholder("Rechercher ou créer un tag").fill("facturable");
  await page.getByRole("button", { name: '+ Créer "facturable"' }).click();
  await page.getByText("CRÉNEAU").click();

  await expect(page.locator("span").filter({ hasText: "facturable" })).toBeVisible();
});

test("selects rows and deletes them in bulk from the detailed tab", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Entrée un", "0800", "0900");
  await addManualEntry(page, "Entrée deux", "0900", "1000");

  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "Détaillé" }).click();

  await expect(page.getByText("Entrée un")).toBeVisible();
  await expect(page.getByText("Entrée deux")).toBeVisible();

  const checkboxes = page.locator('input[type="checkbox"]');
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();

  await expect(page.getByText("2 sélectionnée(s)")).toBeVisible();
  await page.getByRole("button", { name: "Supprimer la sélection" }).click();

  await expect(page.getByText("Aucune donnée pour cette période")).toBeVisible();
});

test("deletes a single entry via the row menu in the detailed tab", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "À retirer");

  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "Détaillé" }).click();
  await expect(page.getByText("À retirer")).toBeVisible();

  await page.getByTitle("Plus d'options").click();
  await page.getByRole("button", { name: "Supprimer" }).click();

  await expect(page.getByText("À retirer")).not.toBeVisible();
  await expect(page.getByText("Aucune donnée pour cette période")).toBeVisible();
});
