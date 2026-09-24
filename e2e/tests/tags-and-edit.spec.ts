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

test("creates a tag on the fly, attaches it to an entry, and marks it billable", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Support client");
  await page.getByTitle("Tags").click();
  await page.getByPlaceholder("Rechercher ou créer un tag").fill("urgent");
  await page.getByRole("button", { name: '+ Créer "urgent"' }).click();
  await page.getByRole("heading", { name: "Suivi du temps" }).click();
  await page.getByTitle("Facturable").click();

  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill("0800");
  await startInput.blur();
  const endInput = page.getByLabel("Heure de fin");
  await endInput.click();
  await endInput.fill("0900");
  await endInput.blur();
  await page.getByRole("button", { name: "AJOUTER" }).click();

  await expect(page.getByText("Support client")).toBeVisible();
  await expect(page.getByText("urgent")).toBeVisible();
});

test("reuses an existing tag from the list instead of creating a duplicate", async ({ page }) => {
  await registerAndLogin(page);

  await addManualEntry(page, "First task with tag");
  await page.getByTitle("Tags").click();
  await page.getByPlaceholder("Rechercher ou créer un tag").fill("billing");
  await page.getByRole("button", { name: '+ Créer "billing"' }).click();
  await page.getByRole("heading", { name: "Suivi du temps" }).click();
  await addManualEntry(page, "Second task, same tag");

  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill("Third task");
  await page.getByTitle("Tags").click();
  await expect(page.locator("label").filter({ hasText: "billing" })).toBeVisible();
  await expect(page.getByRole("button", { name: '+ Créer "billing"' })).not.toBeVisible();
});

test("expands an entry to edit its description inline", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Description initiale");
  await expect(page.getByText("Description initiale")).toBeVisible();

  await page.getByText("Description initiale").click();
  const editInput = page.getByPlaceholder("Description");
  await expect(editInput).toHaveValue("Description initiale");
  await editInput.fill("Description mise à jour");
  await editInput.blur();

  await expect(page.getByText("Description mise à jour")).toBeVisible();
  await expect(page.getByText("Description initiale")).not.toBeVisible();
});

test("edits an entry's start and end time inline via free-form input", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Créneau à corriger", "0800", "0900");
  await expect(page.getByText("01:00:00").last()).toBeVisible();

  await page.getByText("Créneau à corriger").click();
  const endInputs = page.getByLabel("Heure de fin");
  await endInputs.last().click();
  await endInputs.last().fill("1030");
  await endInputs.last().blur();

  await expect(page.getByText("02:30:00").first()).toBeVisible();
});
