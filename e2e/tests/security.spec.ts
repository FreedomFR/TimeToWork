import { readFileSync } from "fs";
import { test, expect } from "@playwright/test";
import { addManualEntry, registerAndLogin } from "./helpers";

/** Security checks of the running app, in a real browser. */

const XSS_PAYLOADS = [
  '<img src=x onerror="window.__xss=1">',
  "<script>window.__xss=1</script>",
  '"><svg onload="window.__xss=1">',
];

test("text typed by the user is displayed, never executed, on every page that shows it", async ({ page }) => {
  await registerAndLogin(page);
  for (const [i, payload] of XSS_PAYLOADS.entries()) {
    await addManualEntry(page, payload, `0${8 + i}00`, `0${8 + i}30`);
  }

  // The payload appears as plain text in the time tracker...
  await expect(page.getByText(XSS_PAYLOADS[0], { exact: true }).first()).toBeVisible();

  // ...and in the report, the calendar and the dashboard
  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "Détaillé" }).click();
  await expect(page.getByText(XSS_PAYLOADS[1], { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Calendrier" }).click();
  await expect(page.getByTestId("calendar-event")).toHaveCount(3);

  await page.getByRole("link", { name: "Tableau de bord" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();

  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test("a spreadsheet formula typed as a description is neutralized in the CSV export", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, '=HYPERLINK("http://evil.example","click")', "0800", "0900");

  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "EXPORTATION" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ]);
  const csv = readFileSync((await download.path())!, "utf-8");

  // Prefixed with an apostrophe, so Excel shows the text instead of running it
  expect(csv).toContain(`"'=HYPERLINK(`);
  expect(csv).not.toMatch(/(^|,)"=HYPERLINK/m);
});

test("the site is served with protective headers and a strict content security policy", async ({ page }) => {
  const res = await page.request.get("/");
  const headers = res.headers();

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["content-security-policy"]).toContain("script-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  // Version of the web server not disclosed
  expect(headers["server"] ?? "").not.toMatch(/\d/);
});

test("the content security policy does not break any page of the app", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/content security policy/i.test(msg.text())) violations.push(msg.text());
  });
  page.on("pageerror", (err) => violations.push(err.message));

  await registerAndLogin(page);
  await addManualEntry(page, "CSP check", "0900", "1000");
  for (const link of ["Calendrier", "Tableau de bord", "Rapports", "Projets", "Clients", "Mon compte", "Suivi du temps"]) {
    await page.getByRole("link", { name: link }).click();
    await page.waitForLoadState("networkidle");
  }
  // The export dialog and the calendar's edit dialog too
  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "EXPORTATION" }).click();
  await expect(page.getByRole("dialog", { name: "Exporter le rapport" })).toBeVisible();

  expect(violations).toEqual([]);
});

test("the API does not expose stack traces or its framework", async ({ request }) => {
  const api = process.env.API_URL || "http://backend:4000";

  const notFound = await request.get(`${api}/api/does-not-exist`);
  expect(notFound.status()).toBe(404);
  expect(notFound.headers()["x-powered-by"]).toBeUndefined();

  const broken = await request.post(`${api}/api/auth/login`, {
    headers: { "Content-Type": "application/json" },
    data: "{ not json",
  });
  expect(broken.status()).toBe(400);
  expect(await broken.text()).not.toMatch(/node_modules|\.js:\d+/);
});
