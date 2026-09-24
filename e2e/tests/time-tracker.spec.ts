import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("runs the timer and stops it, producing a time entry", async ({ page }) => {
  await registerAndLogin(page);

  // Switch from the default manual view into timer mode.
  await page.getByTitle("Passer au minuteur").click();

  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Revue de code");
  await page.getByRole("button", { name: "DÉMARRER" }).click();

  await expect(page.getByRole("button", { name: "ARRÊTER" })).toBeVisible();
  await page.waitForTimeout(2100);
  await page.getByRole("button", { name: "ARRÊTER" }).click();

  await expect(page.getByRole("button", { name: "DÉMARRER" })).toBeVisible();
  await expect(page.getByText("Revue de code")).toBeVisible();
  await expect(page.getByText("Aujourd'hui")).toBeVisible();
});

test("adds a manual entry with a free-form time range and computes the duration", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Rédaction du rapport");

  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill("0800");
  await startInput.blur();
  await expect(startInput).toHaveValue("08:00");

  const endInput = page.getByLabel("Heure de fin");
  await endInput.click();
  await endInput.fill("930");
  await endInput.blur();
  await expect(endInput).toHaveValue("09:30");

  await page.getByRole("button", { name: "AJOUTER" }).click();

  await expect(page.getByText("Rédaction du rapport")).toBeVisible();
  await expect(page.getByText("08:00 - 09:30")).toBeVisible();
  await expect(page.getByText("01:30:00").first()).toBeVisible();
});

test("a manual entry's duration field accepts free text and recomputes the end time", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Appel client");

  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill("0900");
  await startInput.blur();

  const durationInput = page.getByLabel("Durée");
  await durationInput.click();
  await durationInput.fill("1:15");
  await durationInput.blur();

  const endInput = page.getByLabel("Heure de fin");
  await expect(endInput).toHaveValue("10:15");

  await page.getByRole("button", { name: "AJOUTER" }).click();
  await expect(page.getByText("Appel client")).toBeVisible();
  await expect(page.getByText("01:15:00").first()).toBeVisible();
});

test("offers recent task suggestions that prefill description and project", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Site web client");
  await page.getByRole("button", { name: "+ Ajouter" }).click();

  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Maquette page accueil");
  await page.getByRole("button", { name: "Projet" }).click();
  await page.getByText("Site web client").click();

  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill("0800");
  await startInput.blur();
  const endInput = page.getByLabel("Heure de fin");
  await endInput.click();
  await endInput.fill("0900");
  await endInput.blur();
  await page.getByRole("button", { name: "AJOUTER" }).click();
  await expect(page.getByText("Maquette page accueil")).toBeVisible();

  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").click();
  await expect(page.getByText("Tâches récentes")).toBeVisible();

  await page.getByRole("button", { name: /Maquette page accueil/ }).click();
  await expect(page.getByPlaceholder("Sur quoi avez-vous travaillé ?")).toHaveValue(
    "Maquette page accueil"
  );
  await expect(page.getByRole("button", { name: "Site web client" })).toBeVisible();
});

test("deletes a time entry", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("À supprimer");
  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill("0800");
  await startInput.blur();
  const endInput = page.getByLabel("Heure de fin");
  await endInput.click();
  await endInput.fill("0900");
  await endInput.blur();
  await page.getByRole("button", { name: "AJOUTER" }).click();
  await expect(page.getByText("À supprimer")).toBeVisible();

  await page.getByTitle("Plus d'options").click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("À supprimer")).not.toBeVisible();
});
