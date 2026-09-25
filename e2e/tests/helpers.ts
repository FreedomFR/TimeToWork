/**
 * Shared helpers of the E2E suite.
 *
 * Accounts (tests run in parallel, one browser per worker, so accounts are not shared between workers):
 *  - the `setup` project (auth.setup.ts) registers ONE account through the real register page.
 *    It is only used by the login tests, which never modify it (read-only, safe in parallel);
 *  - each worker lazily creates its OWN account through the API, and `registerAndLogin` empties
 *    it and signs the page in before every test, so a test always starts from a brand-new account;
 *  - tests that would alter their account (password change…) use `registerFreshUser`.
 */
import fs from "fs";
import path from "path";
import { Page, expect } from "@playwright/test";

const API_URL = process.env.API_URL || "http://backend:4000";

export const AUTH_DIR = path.join(__dirname, "..", ".auth");
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
  // pid: two workers may create an account in the same millisecond
  const stamp = `${Date.now()}_${process.pid}_${counter}`;
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

/** The account created by the `setup` project. Read-only: the login tests must never modify it. */
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

interface Account {
  user: TestUser;
  token: string;
}

/** Creates an account through the API (fast) and returns it with its session token. */
async function createAccount(): Promise<Account> {
  const user = uniqueUser();
  const { token } = await api("POST", "/auth/register", undefined, user);
  return { user, token };
}

// Each Playwright worker is its own process, so this is one account per worker
let workerAccount: Account | null = null;

/** Signs the page in by storing the session token the way the app does, then opens the time tracker. */
async function signIn(page: Page, token: string) {
  // The login page is public, so it can be opened while signed out to reach the app's origin
  await page.goto("/login");
  await page.evaluate((t) => localStorage.setItem("token", t), token);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Suivi du temps" })).toBeVisible();
}

/**
 * Opens the app signed in as this worker's own test account, emptied of any data left by a
 * previous test, so the test starts from a brand-new account. Created on first use.
 */
export async function registerAndLogin(page: Page): Promise<TestUser> {
  workerAccount ??= await createAccount();
  await resetAccountData(workerAccount.token);
  await signIn(page, workerAccount.token);
  return workerAccount.user;
}

/**
 * Creates a brand-new account and signs the page in as it, leaving the worker's account alone.
 * For tests that would alter their account: password changes, etc.
 */
export async function registerFreshUser(page: Page): Promise<TestUser> {
  const account = await createAccount();
  await signIn(page, account.token);
  return account.user;
}

/**
 * Adds a finished entry from the time tracker's manual mode. Times are typed free-form
 * ("0845"). Must be called on the time tracker page.
 */
export async function addManualEntry(page: Page, description: string, start: string, end: string) {
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
