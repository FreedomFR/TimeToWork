import { test, expect, Page } from "@playwright/test";
import { apiCall, registerAndLogin } from "./helpers";

/**
 * "Veuillez patienter": a message in the middle of the page for as long as the app waits for the server,
 * gone as soon as the data is displayed. The requests are slowed down here by holding them back in the browser.
 */
test.use({ reducedMotion: "no-preference" }); // the clock's hand turns, unless animations are off

const notice = (page: Page) => page.getByRole("status").filter({ hasText: "Veuillez patienter" });

/** Answers requests to `pattern` only after `ms`. */
async function slowDown(page: Page, pattern: string, ms: number) {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue().catch(() => {}); // the page may have moved on
  });
}

async function tokenOf(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem("token") as string);
}

test("the message is there as soon as the wait begins, and gone once the data is displayed", async ({ page }) => {
  await registerAndLogin(page);
  await apiCall("POST", "/projects", await tokenOf(page), { name: "Projet chargé", color: "#2f7dfa" });
  await slowDown(page, "**/api/projects", 2000);

  await page.getByRole("link", { name: "Projets" }).click();
  await expect(notice(page)).toBeVisible({ timeout: 700 }); // no waiting period: it is there right away
  await expect(notice(page)).toContainText("Chargement en cours");
  await expect(page.getByText("Projet chargé")).toHaveCount(0); // ...while there is nothing to show yet

  await expect(page.getByText("Projet chargé")).toBeVisible({ timeout: 5000 });
  await expect(notice(page)).toBeHidden({ timeout: 1000 }); // the data is on screen: the message leaves
});

test("even a fast answer shows it, briefly, and it does not stay", async ({ page }) => {
  await registerAndLogin(page);
  await apiCall("POST", "/projects", await tokenOf(page), { name: "Projet rapide", color: "#2f7dfa" });
  await slowDown(page, "**/api/projects", 300);

  await page.getByRole("link", { name: "Projets" }).click();
  await expect(notice(page)).toBeVisible({ timeout: 700 });
  await expect(page.getByText("Projet rapide")).toBeVisible();
  await expect(notice(page)).toBeHidden({ timeout: 1000 });
});

test("it does not block the page: the user can carry on while waiting", async ({ page }) => {
  await registerAndLogin(page);
  await slowDown(page, "**/api/projects", 3000);

  await page.getByRole("link", { name: "Projets" }).click();
  await expect(notice(page)).toBeVisible({ timeout: 1500 });
  await page.getByRole("link", { name: "Clients" }).click(); // clicks go through the message
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
});

test("a request that fails ends the wait too", async ({ page }) => {
  await registerAndLogin(page);
  await page.route("**/api/projects", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ status: 500, json: { error: "Erreur interne" } }).catch(() => {});
  });

  await page.getByRole("link", { name: "Projets" }).click();
  await expect(notice(page)).toBeVisible({ timeout: 1500 });
  await expect(notice(page)).toBeHidden({ timeout: 5000 });
});

test("background requests (error reports) do not trigger it", async ({ page }) => {
  await registerAndLogin(page);
  await slowDown(page, "**/api/logs/client", 2500);

  // An uncaught error makes the page send a report to the journal, which takes 2.5 s here
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", { error: new Error("erreur de test slow-requests") })));
  await page.waitForTimeout(1500);
  await expect(notice(page)).toHaveCount(0);
});

test("the clock's hand turns, and stands still when animations are off", async ({ page }) => {
  await registerAndLogin(page);
  const hand = () => page.locator(".animate-clock-hand").first();
  const animationName = () => hand().evaluate((el) => getComputedStyle(el).animationName);

  await slowDown(page, "**/api/projects", 2500);
  await page.getByRole("link", { name: "Projets" }).click();
  await expect(notice(page)).toBeVisible({ timeout: 1500 });
  expect(await animationName()).toBe("clock-hand");
  await expect(notice(page)).toBeHidden({ timeout: 6000 });

  // Same slow answer, animations off: the message is still there, without movement
  const token = await page.evaluate(() => localStorage.getItem("token") as string);
  await apiCall("PUT", "/auth/preferences", token, { animations: false });
  await page.reload();
  await page.getByRole("link", { name: "Suivi du temps" }).click();
  await slowDown(page, "**/api/projects", 2500);
  await page.getByRole("link", { name: "Projets" }).click();
  await expect(notice(page)).toBeVisible({ timeout: 1500 });
  expect(await animationName()).toBe("none");
});

/** Fills the manual entry form of the tracker and presses AJOUTER. */
async function submitManualEntry(page: Page, description: string, start: string, end: string) {
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill(description);
  for (const [label, value] of [["Heure de début", start], ["Heure de fin", end]]) {
    const input = page.getByLabel(label);
    await input.click();
    await input.fill(value);
    await input.blur();
  }
  await page.getByRole("button", { name: "AJOUTER" }).click();
}

/** Applies `handler` to the POSTs that create an entry; anything else goes through. */
async function interceptEntryCreation(page: Page, handler: (route: import("@playwright/test").Route) => Promise<void>) {
  await page.route("**/api/time-entries", (route) => (route.request().method() === "POST" ? handler(route) : route.continue()));
}

test("adding an entry empties the form at once, and what is typed while waiting is kept", async ({ page }) => {
  await registerAndLogin(page);
  await interceptEntryCreation(page, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue().catch(() => {});
  });
  const description = page.getByPlaceholder("Sur quoi avez-vous travaillé ?");

  await submitManualEntry(page, "Première tâche", "0800", "0900");
  await expect(description).toHaveValue(""); // no waiting for the server
  await description.fill("Suite déjà en cours de frappe");

  await expect(page.getByText("Première tâche")).toBeVisible({ timeout: 8000 }); // the slow answer arrives
  await expect(description).toHaveValue("Suite déjà en cours de frappe"); // and does not wipe the new text
});

test("a refused entry brings the fields back", async ({ page }) => {
  await registerAndLogin(page);
  await interceptEntryCreation(page, (route) => route.fulfill({ status: 500, json: { error: "Erreur interne" } }));

  await submitManualEntry(page, "Tâche refusée", "0800", "0900");
  await expect(page.getByPlaceholder("Sur quoi avez-vous travaillé ?")).toHaveValue("Tâche refusée");
  await expect(page.getByLabel("Heure de début")).toHaveValue("08:00");
  await expect(page.getByLabel("Heure de fin")).toHaveValue("09:00");
  await expect(page.getByText("Tâche refusée", { exact: true })).toHaveCount(0); // no entry was added to the list
});
