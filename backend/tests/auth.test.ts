import { afterEach, describe, expect, it, vi } from "vitest";
import { app, request, registerUser, uniqueEmail } from "./helpers";
import { sendPasswordResetEmail } from "../src/lib/mailer";
import { prisma } from "../src/lib/prisma";

describe("auth: register", () => {
  it("creates a user and returns a token", async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123", name: "Alice" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user).toMatchObject({ email, name: "Alice" });
    expect(res.body.user.password).toBeUndefined();
  });

  it("rejects a duplicate email", async () => {
    const { user } = await registerUser();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: user.email, password: "password123", name: "Someone else" });

    expect(res.status).toBe(409);
  });

  it("rejects an invalid payload", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "123", name: "" });

    expect(res.status).toBe(400);
  });
});

describe("auth: login", () => {
  it("logs in with correct credentials", async () => {
    const { user } = await registerUser({ password: "correct-horse" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "correct-horse" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.email).toBe(user.email);
  });

  it("rejects a wrong password", async () => {
    const { user } = await registerUser({ password: "correct-horse" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail(), password: "whatever123" });

    expect(res.status).toBe(401);
  });
});

describe("auth: me", () => {
  it("returns the current user when authenticated", async () => {
    const { token, user } = await registerUser();
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });

  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("auth: forgot-password / reset-password", () => {
  it("sends a reset email and lets the user set a new password", async () => {
    const { user } = await registerUser({ password: "old-password" });

    const forgotRes = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    expect(forgotRes.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const [, resetUrl] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    const token = new URL(resetUrl).searchParams.get("token");
    expect(token).toBeTruthy();

    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "new-password-123" });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "old-password" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "new-password-123" });
    expect(newLogin.status).toBe(200);
  });

  it("does not reveal whether an email is registered", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: uniqueEmail() });

    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid or unknown token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", password: "new-password-123" });

    expect(res.status).toBe(400);
  });

  it("rejects a token that has expired", async () => {
    const { user } = await registerUser();

    await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const [, resetUrl] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    const token = new URL(resetUrl).searchParams.get("token")!;

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenExpiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "new-password-123" });

    expect(res.status).toBe(400);
  });

  it("invalidates the token after a single use", async () => {
    const { user } = await registerUser();

    await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const [, resetUrl] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    const token = new URL(resetUrl).searchParams.get("token")!;

    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "new-password-123" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "another-password" });
    expect(second.status).toBe(400);
  });
});

describe("auth: dev mode", () => {
  const originalDevMode = process.env.DEV_MODE;

  afterEach(() => {
    process.env.DEV_MODE = originalDevMode;
  });

  it("hides passwordless login when DEV_MODE is not enabled", async () => {
    process.env.DEV_MODE = "false";

    const usersRes = await request(app).get("/api/auth/dev/users");
    expect(usersRes.status).toBe(404);

    const loginRes = await request(app).post("/api/auth/dev/login").send({ userId: "whatever" });
    expect(loginRes.status).toBe(404);
  });

  it("lists users and logs in without a password when DEV_MODE is enabled", async () => {
    process.env.DEV_MODE = "true";
    const { user } = await registerUser();

    const usersRes = await request(app).get("/api/auth/dev/users");
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.some((u: any) => u.id === user.id)).toBe(true);
    expect(usersRes.body[0].password).toBeUndefined();

    const loginRes = await request(app).post("/api/auth/dev/login").send({ userId: user.id });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTypeOf("string");
    expect(loginRes.body.user.id).toBe(user.id);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toBe(user.id);
  });

  it("404s for an unknown user id even when DEV_MODE is enabled", async () => {
    process.env.DEV_MODE = "true";

    const res = await request(app)
      .post("/api/auth/dev/login")
      .send({ userId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });
});
