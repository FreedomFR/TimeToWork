import { test, expect, Page } from "@playwright/test";
import { registerAndLogin } from "./helpers";

/** Tests of the "Modifier le créneau" dialog opened by clicking a block of the calendar. */

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
  await expect(page.getByPlaceholder("Sur quoi avez-vous travaillé ?")).toHaveValue("");
}

async function openCalendar(page: Page) {
  await page.getByRole("link", { name: "Calendrier" }).click();
  await expect(page.getByRole("button", { name: "Semaine", exact: true })).toBeVisible();
}

const eventByText = (page: Page, text: string) => page.getByTestId("calendar-event").filter({ hasText: text });
const editDialog = (page: Page) => page.getByRole("dialog", { name: "Modifier le créneau" });

async function boxHeight(page: Page, text: string) {
  const b = await eventByText(page, text).boundingBox();
  if (!b) throw new Error(`No bounding box for event "${text}"`);
  return b.height;
}

async function setTime(page: Page, label: string, value: string) {
  const input = editDialog(page).getByLabel(label);
  await input.click();
  await input.fill(value);
  await input.blur();
}

async function openEditor(page: Page, text: string) {
  await eventByText(page, text).click();
  await expect(editDialog(page)).toBeVisible();
}

test("clicking a block opens the edit dialog pre-filled with the entry", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Créneau à modifier", "0900", "1200");
  await openCalendar(page);
  await openEditor(page, "Créneau à modifier");

  const dialog = editDialog(page);
  await expect(dialog.locator("#edit-entry-description")).toHaveValue("Créneau à modifier");
  await expect(dialog.getByLabel("Heure de début")).toHaveValue("09:00");
  await expect(dialog.getByLabel("Heure de fin")).toHaveValue("12:00");
  await expect(dialog.getByLabel("Durée")).toHaveAttribute("placeholder", "03:00:00");
  await expect(dialog.locator("#edit-entry-project")).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
});

test("saving new times and description updates the block, its height and the day total", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Avant", "0900", "1000");
  await openCalendar(page);
  await openEditor(page, "Avant");

  const dialog = editDialog(page);
  await dialog.locator("#edit-entry-description").fill("Après");
  await setTime(page, "Heure de début", "1000");
  await setTime(page, "Heure de fin", "1200");
  // Changing the times refreshes the duration shown in the dialog
  await expect(dialog.getByLabel("Durée")).toHaveAttribute("placeholder", "02:00:00");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toHaveCount(0);

  await expect(eventByText(page, "Avant")).toHaveCount(0);
  const block = eventByText(page, "Après");
  await expect(block).toHaveCount(1);
  expect(await boxHeight(page, "Après")).toBeCloseTo(120, 0);
  await expect(block).toContainText("02:00:00");
  await expect(page.getByTestId("calendar-day-header").filter({ hasText: "02:00:00" })).toHaveCount(1);
});

test("typing a duration moves the end time", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Durée libre", "0900", "1000");
  await openCalendar(page);
  await openEditor(page, "Durée libre");

  const dialog = editDialog(page);
  const duration = dialog.getByLabel("Durée");
  await duration.click();
  await duration.fill("1:30");
  await duration.blur();
  await expect(dialog.getByLabel("Heure de fin")).toHaveValue("10:30");
  await expect(dialog.getByLabel("Heure de début")).toHaveValue("09:00");

  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(eventByText(page, "Durée libre")).toContainText("01:30:00");
});

test("an end time before the start is refused", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Plage invalide", "0900", "1000");
  await openCalendar(page);
  await openEditor(page, "Plage invalide");

  await setTime(page, "Heure de fin", "0800");
  await expect(editDialog(page).getByText("L'heure de fin doit être après l'heure de début.")).toBeVisible();
  await expect(editDialog(page).getByRole("button", { name: "Enregistrer" })).toBeDisabled();

  await setTime(page, "Heure de fin", "1100");
  await expect(editDialog(page).getByRole("button", { name: "Enregistrer" })).toBeEnabled();
});

test("project and tags can be changed from the dialog", async ({ page }) => {
  await registerAndLogin(page);
  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Beta");
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await expect(page.getByText("Beta")).toBeVisible();

  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await addManualEntry(page, "Sans projet", "0900", "1100");
  await openCalendar(page);
  await openEditor(page, "Sans projet");

  const dialog = editDialog(page);
  await dialog.locator("#edit-entry-project").selectOption({ label: "Beta" });
  await dialog.getByTitle("Tags").click();

  // The tag menu overlays the dialog instead of being clipped by it (no inner scrolling needed)
  expect(await dialog.evaluate((el) => getComputedStyle(el).overflowY)).toBe("visible");
  const menuBox = await dialog.getByPlaceholder("Rechercher ou créer un tag").boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(menuBox!.y + menuBox!.height).toBeGreaterThan(dialogBox!.y + dialogBox!.height - 80);

  await dialog.getByPlaceholder("Rechercher ou créer un tag").fill("urgent");
  await dialog.getByPlaceholder("Rechercher ou créer un tag").press("Enter");
  await expect(dialog.getByTitle("Tags")).toContainText("urgent");

  // Escape closes the tag menu only (not the dialog), which uncovers the save button
  await dialog.getByPlaceholder("Rechercher ou créer un tag").press("Escape");
  await expect(dialog.getByPlaceholder("Rechercher ou créer un tag")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toHaveCount(0);

  await expect(eventByText(page, "Sans projet")).toContainText("Beta");

  // Persisted: reopening shows the new project and tag
  await openEditor(page, "Sans projet");
  await expect(editDialog(page).locator("#edit-entry-project")).toHaveValue(/.+/);
  await expect(editDialog(page).getByTitle("Tags")).toContainText("urgent");
});

test("cancel, close button and Escape leave the entry untouched", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Intact", "0900", "1000");
  await openCalendar(page);

  await openEditor(page, "Intact");
  await editDialog(page).locator("#edit-entry-description").fill("Modifié mais annulé");
  await editDialog(page).getByRole("button", { name: "Annuler" }).click();
  await expect(editDialog(page)).toHaveCount(0);

  await openEditor(page, "Intact");
  await editDialog(page).getByRole("button", { name: "Fermer" }).click();
  await expect(editDialog(page)).toHaveCount(0);

  await openEditor(page, "Intact");
  await page.keyboard.press("Escape");
  await expect(editDialog(page)).toHaveCount(0);

  await expect(eventByText(page, "Intact")).toHaveCount(1);
  await expect(eventByText(page, "Modifié mais annulé")).toHaveCount(0);
});

test("an entry can be deleted from the dialog menu", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "À supprimer", "0900", "1000");
  await addManualEntry(page, "À garder", "1100", "1200");
  await openCalendar(page);
  await expect(page.getByTestId("calendar-event")).toHaveCount(2);

  await openEditor(page, "À supprimer");
  await editDialog(page).getByTitle("Plus d'options").click();
  await editDialog(page).getByRole("button", { name: "Supprimer" }).click();
  await expect(editDialog(page)).toHaveCount(0);

  await expect(page.getByTestId("calendar-event")).toHaveCount(1);
  await expect(eventByText(page, "À garder")).toHaveCount(1);
  await expect(page.getByTestId("calendar-day-header").filter({ hasText: "01:00:00" })).toHaveCount(1);
});

test("moving an entry to another date removes it from the current week", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Déplacé", "0900", "1000");
  await openCalendar(page);
  await openEditor(page, "Déplacé");

  await editDialog(page).getByLabel("Date").fill("2030-01-15");
  await editDialog(page).getByRole("button", { name: "Enregistrer" }).click();
  await expect(editDialog(page)).toHaveCount(0);
  await expect(page.getByTestId("calendar-event")).toHaveCount(0);

  // It still exists: the time tracker lists it
  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await expect(page.getByText("Déplacé")).toBeVisible();
});
