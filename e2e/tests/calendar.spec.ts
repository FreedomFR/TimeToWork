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
  // The form empties at once: the entry is saved only when it shows in the list (a page change before that would lose it)
  await expect(page.getByText(description, { exact: true }).first()).toBeVisible();
}

async function openCalendar(page: Page) {
  await page.getByRole("link", { name: "Calendrier" }).click();
  await expect(page.getByRole("button", { name: "Semaine", exact: true })).toBeVisible();
}

const eventByText = (page: Page, text: string) => page.getByTestId("calendar-event").filter({ hasText: text });

async function box(page: Page, text: string) {
  const b = await eventByText(page, text).boundingBox();
  if (!b) throw new Error(`No bounding box for event "${text}"`);
  return b;
}

test("calendar opens on the current week: seven days, empty for a new account", async ({ page }) => {
  await registerAndLogin(page);
  await openCalendar(page);

  await expect(page.getByTestId("calendar-day-header")).toHaveCount(7);
  await expect(page.getByTestId("calendar-event")).toHaveCount(0);
  await expect(page.getByTitle("Choisir une période")).toContainText("Cette semaine");
  await expect(page.getByRole("button", { name: "Semaine", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("entries are drawn at their time with a height proportional to their duration", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Réunion", "0900", "1030");
  await addManualEntry(page, "Développement", "1400", "1600");
  await openCalendar(page);

  await expect(page.getByTestId("calendar-event")).toHaveCount(2);

  // 60 px per hour by default: 1h30 = 90 px, 2h = 120 px
  const meeting = await box(page, "Réunion");
  const dev = await box(page, "Développement");
  expect(meeting.height).toBeCloseTo(90, 0);
  expect(dev.height).toBeCloseTo(120, 0);
  // Five hours later on the same day = 300 px lower, in the same column
  expect(dev.y - meeting.y).toBeCloseTo(300, 0);
  expect(dev.x).toBeCloseTo(meeting.x, 0);

  // The day header carries the day's total: 1h30 + 2h
  await expect(page.getByTestId("calendar-day-header").filter({ hasText: "03:30:00" })).toHaveCount(1);
  // Each block shows its duration
  await expect(eventByText(page, "Réunion")).toContainText("01:30:00");
  await expect(eventByText(page, "Développement")).toContainText("02:00:00");
});

test("overlapping entries are placed side by side", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Premier", "0900", "1100");
  await addManualEntry(page, "Second", "1000", "1200");
  await addManualEntry(page, "Isolé", "1500", "1600");
  await openCalendar(page);

  const first = await box(page, "Premier");
  const second = await box(page, "Second");
  const alone = await box(page, "Isolé");

  // Same width (half of the column each), no horizontal overlap
  expect(first.width).toBeCloseTo(second.width, 0);
  expect(first.x + first.width).toBeLessThanOrEqual(second.x + 1);
  // A non-overlapping entry keeps the full column width
  expect(alone.width).toBeCloseTo(first.width * 2, 0);
});

test("an entry that starts when another ends goes below it, not beside it", async ({ page }) => {
  await registerAndLogin(page);
  // 10 minutes, then the next one right after: no overlap in time
  await addManualEntry(page, "Court", "1400", "1410");
  await addManualEntry(page, "Suite", "1410", "1500");
  await openCalendar(page);

  const short = await box(page, "Court");
  const next = await box(page, "Suite");

  // Same column, same width: one under the other
  expect(next.x).toBeCloseTo(short.x, 0);
  expect(next.width).toBeCloseTo(short.width, 0);
  // Proportional: 10 min = 10 px, and the next block starts right where it ends
  expect(short.height).toBeCloseTo(10, 0);
  expect(next.y - short.y).toBeCloseTo(10, 0);
  expect(short.y + short.height).toBeLessThanOrEqual(next.y + 0.5);
});

test("a very short entry is drawn taller to stay clickable, but never over the next one", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Éclair", "1000", "1005"); // nothing after it: room for the minimum height
  await addManualEntry(page, "Serré", "1200", "1205"); // only 12 minutes before the next entry
  await addManualEntry(page, "Voisin", "1212", "1300");
  await openCalendar(page);

  expect((await box(page, "Éclair")).height).toBeCloseTo(16, 0);

  const tight = await box(page, "Serré");
  const neighbour = await box(page, "Voisin");
  expect(tight.height).toBeCloseTo(12, 0); // would be 16 px, held back at the 12 px of free room
  expect(tight.y + tight.height).toBeLessThanOrEqual(neighbour.y + 0.5);
  expect(neighbour.x).toBeCloseTo(tight.x, 0); // still one under the other
});

test("the block shows the project and its color", async ({ page }) => {
  await registerAndLogin(page);
  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Alpha");
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await expect(page.getByText("Alpha")).toBeVisible();

  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await addManualEntry(page, "Tâche projet", "0900", "1100", "Alpha");
  await openCalendar(page);

  const block = eventByText(page, "Tâche projet");
  await expect(block).toContainText("Alpha");
  // Left border uses the project's color (default project color #03A9F4)
  const border = await block.locator("div").first().evaluate((el) => getComputedStyle(el).borderLeftColor);
  expect(border).toBe("rgb(3, 169, 244)");
});

test("zoom buttons change the hour height, within limits", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Zoom test", "0900", "1000");
  await openCalendar(page);

  expect((await box(page, "Zoom test")).height).toBeCloseTo(60, 0);

  await page.getByRole("button", { name: "Zoom avant" }).click();
  expect((await box(page, "Zoom test")).height).toBeCloseTo(90, 0);

  // Levels are 30 / 45 / 60 / 90 / 120 px per hour: three steps back from 90 reaches the minimum
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Zoom arrière" }).click();
  expect((await box(page, "Zoom test")).height).toBeCloseTo(30, 0);

  // Smallest zoom reached
  await expect(page.getByRole("button", { name: "Zoom arrière" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Zoom avant" })).toBeEnabled();
});

test("day view shows a single day and navigates day by day", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Aujourd'hui seulement", "0900", "1000");
  await openCalendar(page);

  await page.getByRole("button", { name: "Jour", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jour", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("calendar-day-header")).toHaveCount(1);
  await expect(page.getByTitle("Choisir une période")).toContainText("Aujourd'hui");
  await expect(page.getByTestId("calendar-event")).toHaveCount(1);

  await page.getByTitle("Période précédente").click();
  await expect(page.getByTitle("Choisir une période")).toContainText("Hier");
  await expect(page.getByTestId("calendar-event")).toHaveCount(0);

  await page.getByTitle("Période suivante").click();
  await expect(page.getByTestId("calendar-event")).toHaveCount(1);

  // Only day presets are offered in this view
  await page.getByTitle("Choisir une période").click();
  await expect(page.getByRole("button", { name: "Hier" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cette semaine" })).toHaveCount(0);
  await expect(page.getByText("Plage personnalisée...")).toHaveCount(0);
});

test("week navigation moves to other weeks", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Cette semaine", "0900", "1000");
  await openCalendar(page);
  await expect(page.getByTestId("calendar-event")).toHaveCount(1);

  await page.getByTitle("Période précédente").click();
  await expect(page.getByTitle("Choisir une période")).toContainText("Semaine dernière");
  await expect(page.getByTestId("calendar-event")).toHaveCount(0);
  await expect(page.getByTestId("calendar-day-header").filter({ hasText: "00:00:00" })).toHaveCount(7);

  await page.getByTitle("Période suivante").click();
  await expect(page.getByTitle("Choisir une période")).toContainText("Cette semaine");
  await expect(page.getByTestId("calendar-event")).toHaveCount(1);
});

test("hovering a block reveals its details", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Détails", "0930", "1015");
  await openCalendar(page);

  const title = await eventByText(page, "Détails").getAttribute("title");
  expect(title).toContain("Détails");
  expect(title).toContain("09:30 - 10:15");
  expect(title).toContain("00:45:00");
});
