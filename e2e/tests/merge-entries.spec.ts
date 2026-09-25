import { test, expect, Page } from "@playwright/test";
import { addManualEntry, registerAndLogin } from "./helpers";

const MISSION = "7771 - Impression format étiquette";

/** The clickable summary line of the entry (or group) showing the given time range. */
const lineWith = (page: Page, timeRange: string) =>
  page.getByText(timeRange, { exact: true }).locator("xpath=ancestor::div[contains(@class,'cursor-pointer')][1]");

async function openMenu(page: Page, timeRange: string) {
  await lineWith(page, timeRange).getByTitle("Plus d'options").click();
}

test("merges an entry with the previous one when there is no pause between them", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, MISSION, "0845", "1000");
  await addManualEntry(page, MISSION, "1000", "1200");
  await addManualEntry(page, MISSION, "1330", "1400");

  // The three entries are grouped; open the group to see them one by one
  await lineWith(page, "08:45 - 14:00").click();
  await expect(page.getByText("10:00 - 12:00", { exact: true })).toBeVisible();

  await openMenu(page, "10:00 - 12:00");
  await page.getByRole("button", { name: "Fusionner avec le créneau précédent" }).click();

  await expect(page.getByText("08:45 - 12:00", { exact: true })).toBeVisible();
  await expect(page.getByText("08:45 - 10:00", { exact: true })).toHaveCount(0);
  await expect(page.getByText("10:00 - 12:00", { exact: true })).toHaveCount(0);
  await expect(page.getByText("13:30 - 14:00", { exact: true })).toBeVisible();
  // Nothing is lost: 1h15 + 2h + 30min = 3h45 before and after
  await expect(page.getByText("03:45:00").first()).toBeVisible();
  await expect(page.getByText("03:15:00")).toBeVisible();
});

test("merges with the next entry from the earlier one's menu", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, MISSION, "0845", "1000");
  await addManualEntry(page, MISSION, "1000", "1200");

  await lineWith(page, "08:45 - 12:00").click();
  await openMenu(page, "08:45 - 10:00");
  await page.getByRole("button", { name: "Fusionner avec le créneau suivant" }).click();

  // A single entry remains, shown as a plain row
  await expect(page.getByText("08:45 - 12:00", { exact: true })).toBeVisible();
  await expect(page.getByText("03:15:00").first()).toBeVisible();
  await expect(page.getByText("08:45 - 10:00", { exact: true })).toHaveCount(0);
});

test("offers no merge across a pause, or between different missions", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, MISSION, "0845", "1000");
  await addManualEntry(page, MISSION, "1330", "1400"); // 3h30 pause after the first
  await addManualEntry(page, "Autre mission", "1400", "1500"); // contiguous, but not the same mission

  await lineWith(page, "08:45 - 14:00").click();
  await openMenu(page, "13:30 - 14:00");
  await expect(page.getByRole("button", { name: "Supprimer" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fusionner/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // The group row itself offers nothing to merge either
  await lineWith(page, "08:45 - 14:00").getByTitle("Plus d'options").count().then((n) => expect(n).toBe(0));
  // The other mission is not a group: its single row only offers deletion
  await openMenu(page, "14:00 - 15:00");
  await expect(page.getByRole("button", { name: /Fusionner/ })).toHaveCount(0);
});

test("the group menu merges every run of consecutive entries at once", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, MISSION, "0750", "0845");
  await addManualEntry(page, MISSION, "0845", "1000");
  await addManualEntry(page, MISSION, "1000", "1200");
  await addManualEntry(page, MISSION, "1330", "1400");

  await openMenu(page, "07:50 - 14:00");
  await page.getByRole("button", { name: "Fusionner les créneaux consécutifs" }).click();

  // 07:50 → 12:00 in one piece, the afternoon one stays apart: two entries, same total
  await expect(page.getByText("07:50 - 14:00", { exact: true })).toBeVisible(); // group summary
  await lineWith(page, "07:50 - 14:00").click();
  await expect(page.getByText("07:50 - 12:00", { exact: true })).toBeVisible();
  await expect(page.getByText("13:30 - 14:00", { exact: true })).toBeVisible();
  await expect(page.getByText("04:40:00").first()).toBeVisible();
  // Nothing left to merge in this group
  await expect(lineWith(page, "07:50 - 14:00").getByTitle("Plus d'options")).toHaveCount(0);
});

test("merged entries stay merged after reloading the page", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, MISSION, "0900", "1000");
  await addManualEntry(page, MISSION, "1000", "1100");

  await openMenu(page, "09:00 - 11:00");
  await page.getByRole("button", { name: "Fusionner les créneaux consécutifs" }).click();
  await expect(page.getByText("02:00:00").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("09:00 - 11:00", { exact: true })).toBeVisible();
  await expect(page.getByText("09:00 - 10:00", { exact: true })).toHaveCount(0);
});
