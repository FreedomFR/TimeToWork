/**
 * Shared helpers of the E2E suite.
 *
 * Accounts: the `setup` project (auth.setup.ts) registers ONE test account through
 * the register page and saves its session; every other test starts already signed in
 * as that account. To keep tests independent, `registerAndLogin` wipes the account's
 * data (through the API) at the start of each test, so it always looks brand new.
 * Tests that must not touch the shared account (e.g. changing its password) use
 * `registerFreshUser` instead.
 */
import fs from "fs";
import path from "path";
import { Page, expect } from "@playwright/test";

const API_URL = process.env.API_URL || "http://backend:4000";

export const AUTH_DIR = path.join(__dirname, "..", ".auth");
export const STORAGE_STATE = path.join(AUTH_DIR, "user.json");
export const CREDENTIALS_FILE = path.join(AUTH_DIR, "credentials.json");

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

let counter = 0;

/** A never-used account identity (the "E2E User" prefix lets the cleanup script find it). */
export function uniqueUser(): TestUser {
  counter += 1;
  const stamp = `${Date.now()}_${counter}`;
  return {
    name: `E2E User ${stamp}`,
    email: `e2e_${stamp}@example.com`,
    password: "password123",
  };
}

// ─── Account creation ──────────────────────────────────────────────────────

/** Creates `user` by filling in the register page, and waits for the time tracker. */
export async function registerViaUi(page: Page, user: TestUser) {
  await page.goto("/register");
  await page.locator("#register-name").fill(user.name);
  await page.locator("#register-email").fill(user.email);
  await page.locator("#register-password").fill(user.password);
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
}

/** The account created by the `setup` project. */
export function sharedUser(): TestUser {
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
}

// ─── API access (used to reset data and to create throwaway accounts quickly) ─

async function api(method: string, url: string, token?: string, body?: unknown) {
  const res = await fetch(`${API_URL}/api${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} failed with ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** Deletes every time entry, project, client and tag of the account. */
async function resetAccountData(token: string) {
  // Entries first: they reference projects and tags
  for (const collection of ["time-entries", "projects", "clients", "tags"]) {
    const items: { id: string }[] = await api("GET", `/${collection}`, token);
    await Promise.all(items.map((item) => api("DELETE", `/${collection}/${item.id}`, token)));
  }
}

// ─── What tests call ───────────────────────────────────────────────────────

/**
 * Opens the app as the shared test account, emptied of any data left by a previous test.
 * The browser context is already signed in (session saved by the `setup` project).
 */
export async function registerAndLogin(page: Page): Promise<TestUser> {
  const user = sharedUser();
  const { token } = await api("POST", "/auth/login", undefined, { email: user.email, password: user.password });
  await resetAccountData(token);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  return user;
}

/**
 * Creates a brand-new account (through the API, so it is fast) and signs the page in as it.
 * For tests that would otherwise affect the shared account: password changes, etc.
 */
export async function registerFreshUser(page: Page): Promise<TestUser> {
  const user = uniqueUser();
  const { token } = await api("POST", "/auth/register", undefined, user);

  await page.goto("/");
  await page.evaluate((t) => localStorage.setItem("token", t), token);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
  return user;
}
