import { describe, expect, it, vi } from "vitest";
import { app, authed, registerUser, request, uniqueEmail } from "./helpers";
import { prisma } from "../src/lib/prisma";
import { flushLogs } from "../src/lib/logger";
import { sendPasswordResetEmail } from "../src/lib/mailer";

/**
 * The journal records account activity (sign-up, sign-in and out, password requests and changes)
 * with the information used — the address and the browser — but never a password or a reset link.
 */

const UA = "Mozilla/5.0 (X11; Linux x86_64) TimeToWorkTest/1.0";

/** Journal entries of an account, once pending writes are done. */
async function logsOf(userId: string, type?: string) {
  await flushLogs();
  return prisma.logEntry.findMany({ where: { userId, type }, orderBy: { createdAt: "asc" } });
}

async function registerAdmin() {
  const account = await registerUser();
  await prisma.user.update({ where: { id: account.user.id }, data: { role: "ADMIN" } });
  return account;
}

const register = (email: string, name = "Nora Test", password = "Sup3r-secret-pw") =>
  request(app).post("/api/auth/register").set("User-Agent", UA).send({ email, password, name });

describe("account activity: sign-up", () => {
  it("records a sign-up with the information used, never the password", async () => {
    const email = uniqueEmail();
    const res = await register(email);
    expect(res.status).toBe(201);

    const [entry] = await logsOf(res.body.user.id, "account_created");
    expect(entry).toMatchObject({
      level: "info",
      message: "Compte créé",
      statusCode: 201,
      method: "POST",
      path: "/api/auth/register",
      userEmail: email,
      userAgent: UA,
    });
    expect(entry.ip).toBeTruthy();
    expect(JSON.parse(entry.details!)).toEqual({ name: "Nora Test" });

    const leaks = await prisma.logEntry.findMany({
      where: { OR: [{ message: { contains: "Sup3r" } }, { details: { contains: "Sup3r" } }, { path: { contains: "Sup3r" } }] },
    });
    expect(leaks).toHaveLength(0);
  });

  it("records a sign-up refused because the email is already used", async () => {
    const { user } = await registerUser();
    const res = await register(user.email);
    expect(res.status).toBe(409);

    await flushLogs();
    const entries = await prisma.logEntry.findMany({ where: { userEmail: user.email, type: "auth_failed" } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "warn",
      statusCode: 409,
      message: "Inscription refusée : email déjà utilisé",
      userAgent: UA,
    });
  });
});

describe("account activity: sign-in and sign-out", () => {
  it("records every sign-in and sign-out", async () => {
    const { user } = await registerUser({ password: "correct-horse-battery" });
    const login = await request(app)
      .post("/api/auth/login")
      .set("User-Agent", UA)
      .send({ email: user.email, password: "correct-horse-battery" });
    expect(login.status).toBe(200);
    await request(app).post("/api/auth/login").send({ email: user.email, password: "correct-horse-battery" });

    const logins = await logsOf(user.id, "login");
    expect(logins).toHaveLength(2);
    expect(logins[0]).toMatchObject({ level: "info", message: "Connexion", statusCode: 200, userEmail: user.email, userAgent: UA });
    expect(logins[0].ip).toBeTruthy();

    expect((await request(app).post("/api/auth/logout")).status).toBe(401);
    const out = await authed(login.body.token).post("/api/auth/logout").set("User-Agent", UA);
    expect(out.status).toBe(204);
    const [logout] = await logsOf(user.id, "logout");
    expect(logout).toMatchObject({ level: "info", message: "Déconnexion", userEmail: user.email, userAgent: UA });
  });

  it("records a passwordless DEV sign-in as a warning", async () => {
    const original = process.env.DEV_MODE;
    process.env.DEV_MODE = "true";
    try {
      const { user } = await registerUser();
      const res = await request(app).post("/api/auth/dev/login").set("User-Agent", UA).send({ userId: user.id });
      expect(res.status).toBe(200);

      const [entry] = await logsOf(user.id, "login");
      expect(entry).toMatchObject({ level: "warn", userEmail: user.email });
      expect(entry.message).toMatch(/mode DEV/);
      expect(JSON.parse(entry.details!)).toEqual({ method: "dev" });
    } finally {
      process.env.DEV_MODE = original;
    }
  });
});

describe("account activity: passwords", () => {
  it("records reset requests for known and unknown accounts alike, answering the same way", async () => {
    const { user } = await registerUser();
    const unknown = uniqueEmail();
    const ask = (email: string) => request(app).post("/api/auth/forgot-password").set("User-Agent", UA).send({ email });

    const known = await ask(user.email);
    const other = await ask(unknown);
    expect(other.status).toBe(known.status);
    expect(other.body).toEqual(known.body); // the visitor learns nothing

    const [requested] = await logsOf(user.id, "password_reset_requested");
    expect(requested).toMatchObject({ level: "info", userEmail: user.email, userAgent: UA });

    await flushLogs();
    const [ghost] = await prisma.logEntry.findMany({ where: { type: "password_reset_requested", userEmail: unknown } });
    expect(ghost).toMatchObject({ level: "warn", userId: null });
    expect(ghost.message).toMatch(/inexistant/);
  });

  it("records a completed reset (never the link) and a password change", async () => {
    const { user } = await registerUser({ password: "old-password" });

    await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const [, resetUrl] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    const resetToken = new URL(resetUrl).searchParams.get("token")!;
    const reset = await request(app)
      .post("/api/auth/reset-password")
      .set("User-Agent", UA)
      .send({ token: resetToken, password: "new-password-123" });
    expect(reset.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "new-password-123" });
    const changed = await authed(login.body.token)
      .post("/api/auth/change-password")
      .set("User-Agent", UA)
      .send({ currentPassword: "new-password-123", newPassword: "yet-another-pw-1" });
    expect(changed.status).toBe(200);

    const [done] = await logsOf(user.id, "password_reset_done");
    expect(done).toMatchObject({ level: "info", message: "Mot de passe réinitialisé", userEmail: user.email, userAgent: UA });
    const [modified] = await logsOf(user.id, "password_changed");
    expect(modified).toMatchObject({ level: "info", message: "Mot de passe modifié", userEmail: user.email, userAgent: UA });

    const leaks = await prisma.logEntry.findMany({
      where: { OR: [{ message: { contains: resetToken } }, { details: { contains: resetToken } }, { path: { contains: resetToken } }] },
    });
    expect(leaks).toHaveLength(0);
  });
});

describe("account activity: information kept", () => {
  it("keeps the address and browser on the other journaled requests too", async () => {
    const { token, user } = await registerUser();
    await authed(token).post("/api/time-entries").set("User-Agent", UA).send({ start: "garbage" });

    const [entry] = await logsOf(user.id, "validation_error");
    expect(entry).toMatchObject({ userAgent: UA });
    expect(entry.ip).toBeTruthy();
  });

  it("truncates an absurdly long browser string", async () => {
    const { user } = await registerUser();
    await request(app)
      .post("/api/auth/login")
      .set("User-Agent", "A".repeat(500))
      .send({ email: user.email, password: "wrong-password-1" });

    const [entry] = await logsOf(user.id, "auth_failed");
    expect(entry.userAgent!.length).toBeLessThanOrEqual(200);
  });

  it("shows the address and browser to admins, who can search on them", async () => {
    const admin = await registerAdmin();
    const marker = `Marker${Date.now()}`;
    const email = uniqueEmail();
    const res = await request(app)
      .post("/api/auth/register")
      .set("User-Agent", `${UA} ${marker}`)
      .send({ email, password: "password123", name: "Sam" });
    expect(res.status).toBe(201);
    await flushLogs();

    const found = await authed(admin.token).get(`/api/admin/logs?q=${marker}`);
    expect(found.status).toBe(200);
    expect(found.body.total).toBe(1);
    expect(found.body.items[0]).toMatchObject({ type: "account_created", userEmail: email });
    expect(found.body.items[0].userAgent).toContain(marker);
    expect(found.body.items[0].ip).toBeTruthy();

    const summary = await authed(admin.token).get("/api/admin/logs/summary");
    for (const type of ["account_created", "login", "logout", "password_reset_requested", "password_reset_done", "password_changed"]) {
      expect(summary.body.types).toContain(type);
    }
  });
});
