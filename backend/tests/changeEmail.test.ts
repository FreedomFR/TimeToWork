import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app, authed, registerUser, request, uniqueEmail } from "./helpers";
import { prisma } from "../src/lib/prisma";
import { flushLogs } from "../src/lib/logger";
import { sendEmailChangedNotice, sendPasswordResetEmail } from "../src/lib/mailer";

const PASSWORD = "current-password-1";

const changeEmail = (token: string, newEmail: string, currentPassword = PASSWORD) =>
  authed(token).post("/api/auth/change-email").send({ currentPassword, newEmail });

async function logsOf(userId: string, type: string) {
  await flushLogs();
  return prisma.logEntry.findMany({ where: { userId, type }, orderBy: { createdAt: "asc" } });
}

describe("change email", () => {
  it("changes the email: the new one signs in, the old one no longer does, the session stays valid", async () => {
    const { token, user } = await registerUser({ password: PASSWORD });
    const newEmail = uniqueEmail();

    const res = await changeEmail(token, newEmail);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, email: newEmail, name: user.name, role: "USER" });
    expect(res.body.password).toBeUndefined();

    const withNew = await request(app).post("/api/auth/login").send({ email: newEmail, password: PASSWORD });
    expect(withNew.status).toBe(200);
    const withOld = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
    expect(withOld.status).toBe(401);

    // The token held by the browser keeps working, and now reports the new email
    const me = await authed(token).get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(newEmail);
  });

  it("frees the old address for someone else", async () => {
    const { token, user } = await registerUser({ password: PASSWORD });
    await changeEmail(token, uniqueEmail());

    const claimed = await request(app).post("/api/auth/register").send({ email: user.email, password: "password123", name: "Newcomer" });
    expect(claimed.status).toBe(201);
  });

  it("tells the old address about the change", async () => {
    const { token, user } = await registerUser({ password: PASSWORD });
    const newEmail = uniqueEmail();
    await changeEmail(token, newEmail);

    await vi.waitFor(() => expect(sendEmailChangedNotice).toHaveBeenCalledWith(user.email, newEmail));
  });

  it("still succeeds when the notice cannot be sent", async () => {
    vi.mocked(sendEmailChangedNotice).mockRejectedValueOnce(new Error("SMTP down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { token } = await registerUser({ password: PASSWORD });
    const newEmail = uniqueEmail();

    const res = await changeEmail(token, newEmail);
    consoleSpy.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(newEmail);
  });

  it("journals the change with the old and new address, and where it came from", async () => {
    const { token, user } = await registerUser({ password: PASSWORD });
    const newEmail = uniqueEmail();
    await authed(token).post("/api/auth/change-email").set("User-Agent", "EmailTest/1.0").send({ currentPassword: PASSWORD, newEmail });

    const [entry] = await logsOf(user.id, "email_changed");
    expect(entry).toMatchObject({ level: "info", message: "Email modifié", statusCode: 200, userEmail: newEmail, userAgent: "EmailTest/1.0" });
    expect(entry.ip).toBeTruthy();
    expect(JSON.parse(entry.details!)).toEqual({ from: user.email, to: newEmail });

    // The password used to confirm is nowhere in the journal
    const leaks = await prisma.logEntry.findMany({ where: { OR: [{ message: { contains: PASSWORD } }, { details: { contains: PASSWORD } }] } });
    expect(leaks).toHaveLength(0);
  });

  it("cancels a password reset link issued for the old address", async () => {
    const { token, user } = await registerUser({ password: PASSWORD });
    await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const [, resetUrl] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    const resetToken = new URL(resetUrl).searchParams.get("token")!;

    await changeEmail(token, uniqueEmail());

    const reset = await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: "hijack-password-1" });
    expect(reset.status).toBe(400);
  });
});

describe("change email: refusals", () => {
  it("requires the current password, and leaves the email untouched", async () => {
    const { token, user } = await registerUser({ password: PASSWORD });

    const res = await changeEmail(token, uniqueEmail(), "not-my-password");

    // 400, not 401: the frontend logs the user out on any 401
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Mot de passe actuel incorrect");
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.email).toBe(user.email);

    const [entry] = await logsOf(user.id, "auth_failed");
    expect(entry.message).toMatch(/Changement d'email/);
    expect(sendEmailChangedNotice).not.toHaveBeenCalled();
  });

  it("refuses an address used by another account, whatever the letter case", async () => {
    const { token, user } = await registerUser({ password: PASSWORD });
    const other = await registerUser();

    for (const attempt of [other.user.email, other.user.email.toUpperCase()]) {
      const res = await changeEmail(token, attempt);
      expect(res.status, attempt).toBe(409);
      expect(res.body.error).toBe("Cet email est déjà utilisé");
    }
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.email).toBe(user.email);

    const [entry] = await logsOf(user.id, "auth_failed");
    expect(entry).toMatchObject({ level: "warn", statusCode: 409 });
    expect(entry.message).toMatch(/déjà utilisé/);
  });

  it("refuses the address the account already has, whatever the letter case", async () => {
    const { token, user } = await registerUser({ password: PASSWORD });
    expect((await changeEmail(token, user.email)).status).toBe(400);
    expect((await changeEmail(token, user.email.toUpperCase())).status).toBe(400);
  });

  it("refuses an invalid address", async () => {
    const { token } = await registerUser({ password: PASSWORD });
    for (const bad of ["", "not-an-email", "a@", "@b.com", `${"x".repeat(250)}@example.com`]) {
      expect((await changeEmail(token, bad)).status, bad).toBe(400);
    }
    expect((await authed(token).post("/api/auth/change-email").send({ newEmail: uniqueEmail() })).status).toBe(400); // no password
  });

  it("requires a signed-in user", async () => {
    const res = await request(app).post("/api/auth/change-email").send({ currentPassword: PASSWORD, newEmail: uniqueEmail() });
    expect(res.status).toBe(401);
  });
});

describe("change email: rate limit", () => {
  beforeAll(() => {
    process.env.RATE_LIMIT_DISABLED = "false";
  });
  afterAll(() => {
    process.env.RATE_LIMIT_DISABLED = "true";
  });

  it("locks the route after 10 wrong passwords, even for the right one", async () => {
    const { token } = await registerUser({ password: PASSWORD });

    for (let i = 0; i < 10; i++) expect((await changeEmail(token, uniqueEmail(), `guess-${i}-xxxx`)).status).toBe(400);

    expect((await changeEmail(token, uniqueEmail(), PASSWORD)).status).toBe(429);
  });
});
