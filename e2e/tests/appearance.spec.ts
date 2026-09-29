import { test, expect, Page } from "@playwright/test";
import { apiCall, registerAndLogin, registerFreshUser } from "./helpers";

/**
 * "Mon compte" > Apparence: animations on/off and text size. The settings are kept on the account,
 * applied at once, and follow the user (reload, sign-out / sign-in, another browser).
 * These tests run with the operating system's "reduce motion" off, like a normal user; the
 * last block turns it on.
 */
test.use({ reducedMotion: "no-preference" }); // overrides the suite-wide "reduce" of playwright.config.ts

const html = (page: Page) => page.locator("html");
const animationsSwitch = (page: Page) => page.getByRole("switch", { name: "Animations" });
const sizeButton = (page: Page, label: string) => page.getByRole("radio", { name: label, exact: true });
/** CSS `animation-name` of an element: "none" when animations are off, the effect's name when on. */
const animationOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);
const rootFontSize = (page: Page) => html(page).evaluate((el) => getComputedStyle(el).fontSize);
const tokenOf = (page: Page) => page.evaluate(() => localStorage.getItem("token") as string);

async function openAppearance(page: Page) {
  await page.getByRole("link", { name: "Mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Apparence" })).toBeVisible();
}

test("new accounts start with animations on and normal text", async ({ page }) => {
  await registerFreshUser(page);
  await openAppearance(page);

  await expect(animationsSwitch(page)).toHaveAttribute("aria-checked", "true");
  await expect(sizeButton(page, "Normale")).toHaveAttribute("aria-checked", "true");
  await expect(html(page)).toHaveAttribute("data-animations", "on");
  await expect(html(page)).toHaveAttribute("data-text-size", "normal");
  expect(await rootFontSize(page)).toBe("16px");
});

test("animations: pages fade in, and turning them off stops it at once", async ({ page }) => {
  await registerAndLogin(page);
  // Changing page replays the entrance effect...
  await page.getByRole("link", { name: "Projets" }).click();
  await expect(page.getByRole("heading", { name: "Projets" })).toBeVisible();
  expect(await animationOf(page, "main")).toBe("page-in");

  await openAppearance(page);
  await animationsSwitch(page).click();
  await expect(page.getByRole("status")).toHaveText("Réglage enregistré");
  await expect(animationsSwitch(page)).toHaveAttribute("aria-checked", "false");
  await expect(html(page)).toHaveAttribute("data-animations", "off");

  // ...until animations are off: no effect, no transition anywhere
  await page.getByRole("link", { name: "Projets" }).click();
  await expect(page.getByRole("heading", { name: "Projets" })).toBeVisible();
  expect(await animationOf(page, "main")).toBe("none");
  const transition = await page
    .getByRole("link", { name: "Mon compte" })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(transition).toBe("0s");
});

test("animations: dialogs use them only while they are on", async ({ page }) => {
  await registerAndLogin(page);
  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "EXPORTATION" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await animationOf(page, '[role="dialog"]')).toBe("dialog-in");
  await page.keyboard.press("Escape");

  await apiCall("PUT", "/auth/preferences", await tokenOf(page), { animations: false });
  await page.reload();
  await page.getByRole("button", { name: "EXPORTATION" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await animationOf(page, '[role="dialog"]')).toBe("none");
});

test("the switch can be used from the keyboard", async ({ page }) => {
  await registerAndLogin(page);
  await openAppearance(page);
  await animationsSwitch(page).focus();
  await page.keyboard.press("Space");
  await expect(animationsSwitch(page)).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Enter");
  await expect(animationsSwitch(page)).toHaveAttribute("aria-checked", "true");
});

test("text size: the whole interface scales, and the choice is kept after a reload", async ({ page }) => {
  await registerAndLogin(page);
  await openAppearance(page);

  await sizeButton(page, "Grande").click();
  await expect(html(page)).toHaveAttribute("data-text-size", "large");
  expect(await rootFontSize(page)).toBe("18px");

  await sizeButton(page, "Très grande").click();
  await expect(html(page)).toHaveAttribute("data-text-size", "xlarge");
  expect(await rootFontSize(page)).toBe("20px");
  await expect(sizeButton(page, "Très grande")).toHaveAttribute("aria-checked", "true");

  await page.reload();
  await expect(html(page)).toHaveAttribute("data-text-size", "xlarge");
  await expect(sizeButton(page, "Très grande")).toHaveAttribute("aria-checked", "true");
});

test("the settings are saved on the account, not just in the browser", async ({ page }) => {
  await registerAndLogin(page);
  await openAppearance(page);
  await animationsSwitch(page).click();
  await sizeButton(page, "Grande").click();
  await expect(html(page)).toHaveAttribute("data-text-size", "large");
  await expect(page.getByRole("status")).toHaveText("Réglage enregistré");

  // What the server holds is what another browser would get
  const me = await apiCall("GET", "/auth/me", await tokenOf(page));
  expect(me.preferences).toEqual({ animations: false, textSize: "large" });

  // A browser with no cache at all (another device) gets them from the server
  await page.evaluate(() => localStorage.removeItem("appearance"));
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-animations", "off");
  await expect(html(page)).toHaveAttribute("data-text-size", "large");
});

test("signing out drops the settings, and they come back at the next sign-in", async ({ page }) => {
  const user = await registerFreshUser(page);
  await openAppearance(page);
  await sizeButton(page, "Très grande").click();
  await animationsSwitch(page).click();
  await expect(html(page)).toHaveAttribute("data-text-size", "xlarge");
  await expect(page.getByRole("status")).toHaveText("Réglage enregistré");

  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page.locator("#login-email")).toBeVisible();
  // The login screen is back to the default look: the next person must not inherit the settings
  await expect(html(page)).toHaveAttribute("data-text-size", "normal");
  await expect(html(page)).toHaveAttribute("data-animations", "on");

  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-text-size", "xlarge");
  await expect(html(page)).toHaveAttribute("data-animations", "off");
});

test("a refused save puts the setting back and says so", async ({ page }) => {
  await registerAndLogin(page);
  await openAppearance(page);
  await page.route("**/api/auth/preferences", (route) => route.fulfill({ status: 500, json: { error: "Erreur interne" } }));

  await sizeButton(page, "Grande").click();
  await expect(page.getByRole("alert")).toContainText("Erreur interne");
  await expect(sizeButton(page, "Normale")).toHaveAttribute("aria-checked", "true");
  await expect(html(page)).toHaveAttribute("data-text-size", "normal");
});

test.describe("when the system asks to reduce motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("animations stay off whatever the setting, and the page says why", async ({ page }) => {
    await registerAndLogin(page);
    await openAppearance(page);

    await expect(animationsSwitch(page)).toHaveAttribute("aria-checked", "true"); // the account's own choice is untouched
    await expect(page.getByText("Votre système demande de réduire les animations")).toBeVisible();
    expect(await animationOf(page, "main")).toBe("none");
  });
});
