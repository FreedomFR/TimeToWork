import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { app, authed, registerUser, request, uniqueEmail } from "./helpers";
import { prisma } from "../src/lib/prisma";

/**
 * Security regression tests: what a hostile (but signed-in) user, or an anonymous visitor,
 * must NOT be able to do. Each block guards a hole that was found and fixed.
 */

const SECRET = process.env.JWT_SECRET as string;
const A_DAY = "2026-09-23T09:00:00.000Z";
const A_DAY_LATER = "2026-09-23T10:00:00.000Z";

describe("security: data of other users cannot be referenced", () => {
  async function twoUsersWithData() {
    const owner = await registerUser();
    const intruder = await registerUser();
    const client = (await authed(owner.token).post("/api/clients").send({ name: "Owner client" })).body;
    const project = (await authed(owner.token).post("/api/projects").send({ name: "Owner project", clientId: client.id })).body;
    const tag = (await authed(owner.token).post("/api/tags").send({ name: "owner-tag" })).body;
    return { owner, intruder, client, project, tag };
  }

  it("refuses an entry linked to someone else's project, and leaks nothing about it", async () => {
    const { intruder, project } = await twoUsersWithData();

    const res = await authed(intruder.token)
      .post("/api/time-entries")
      .send({ description: "x", projectId: project.id, start: A_DAY, end: A_DAY_LATER });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain("Owner project");
    expect((await authed(intruder.token).get("/api/time-entries")).body).toHaveLength(0);
  });

  it("refuses an entry linked to someone else's tag", async () => {
    const { intruder, tag } = await twoUsersWithData();

    const res = await authed(intruder.token)
      .post("/api/time-entries")
      .send({ description: "x", tagIds: [tag.id], start: A_DAY, end: A_DAY_LATER });

    expect(res.status).toBe(400);
  });

  it("refuses to start a timer or edit an entry onto someone else's project", async () => {
    const { intruder, project } = await twoUsersWithData();

    const start = await authed(intruder.token).post("/api/time-entries/start").send({ projectId: project.id });
    expect(start.status).toBe(400);

    const own = (await authed(intruder.token).post("/api/time-entries").send({ description: "mine", start: A_DAY, end: A_DAY_LATER })).body;
    const edit = await authed(intruder.token).put(`/api/time-entries/${own.id}`).send({ projectId: project.id });
    expect(edit.status).toBe(400);
    const editTags = await authed(intruder.token).put(`/api/time-entries/${own.id}`).send({ tagIds: [project.id] });
    expect(editTags.status).toBe(400);
  });

  it("refuses a project linked to someone else's client", async () => {
    const { intruder, client } = await twoUsersWithData();

    const create = await authed(intruder.token).post("/api/projects").send({ name: "p", clientId: client.id });
    expect(create.status).toBe(400);
    expect(JSON.stringify(create.body)).not.toContain("Owner client");

    const own = (await authed(intruder.token).post("/api/projects").send({ name: "mine" })).body;
    const update = await authed(intruder.token).put(`/api/projects/${own.id}`).send({ clientId: client.id });
    expect(update.status).toBe(400);
  });

  it("still accepts the user's own project, tags and client", async () => {
    const { owner, client, project, tag } = await twoUsersWithData();

    const res = await authed(owner.token)
      .post("/api/time-entries")
      .send({ description: "ok", projectId: project.id, tagIds: [tag.id], start: A_DAY, end: A_DAY_LATER });
    expect(res.status).toBe(201);

    const proj = await authed(owner.token).post("/api/projects").send({ name: "another", clientId: client.id });
    expect(proj.status).toBe(201);
  });

  it("answers a clean 400 (not a crash) for ids that don't exist, and stays healthy", async () => {
    const { token } = await registerUser();
    const ghost = "00000000-0000-4000-8000-000000000000";

    const res = await authed(token)
      .post("/api/time-entries")
      .send({ description: "x", projectId: ghost, start: A_DAY, end: A_DAY_LATER });
    expect(res.status).toBe(400);
    const tags = await authed(token).post("/api/time-entries").send({ tagIds: [ghost], start: A_DAY, end: A_DAY_LATER });
    expect(tags.status).toBe(400);

    expect((await request(app).get("/api/health")).status).toBe(200);
  });
});

describe("security: input validation", () => {
  it("rejects malformed dates instead of failing inside the database", async () => {
    const { token } = await registerUser();

    expect((await authed(token).post("/api/time-entries").send({ start: "garbage" })).status).toBe(400);
    expect((await authed(token).get("/api/time-entries?from=garbage")).status).toBe(400);
    expect((await authed(token).get("/api/reports/summary?to=not-a-date")).status).toBe(400);
  });

  it("rejects an entry that ends before it starts, on create and on edit", async () => {
    const { token } = await registerUser();

    const create = await authed(token).post("/api/time-entries").send({ start: A_DAY_LATER, end: A_DAY });
    expect(create.status).toBe(400);

    const entry = (await authed(token).post("/api/time-entries").send({ start: A_DAY, end: A_DAY_LATER })).body;
    const edit = await authed(token).put(`/api/time-entries/${entry.id}`).send({ end: "2026-09-23T08:00:00.000Z" });
    expect(edit.status).toBe(400);
    const moveStart = await authed(token).put(`/api/time-entries/${entry.id}`).send({ start: "2026-09-23T11:00:00.000Z" });
    expect(moveStart.status).toBe(400);
  });

  it("bounds text fields and restricts colors to #rrggbb", async () => {
    const { token } = await registerUser();

    expect((await authed(token).post("/api/time-entries").send({ description: "x".repeat(2001), start: A_DAY })).status).toBe(400);
    expect((await authed(token).post("/api/projects").send({ name: "x".repeat(201) })).status).toBe(400);
    expect((await authed(token).post("/api/projects").send({ name: "p", color: "red; background:url(//evil)" })).status).toBe(400);
    expect((await authed(token).post("/api/projects").send({ name: "p", color: "#12345" })).status).toBe(400);
    expect((await authed(token).post("/api/projects").send({ name: "p", color: "#1a2B3c" })).status).toBe(201);
  });

  it("answers 400 JSON for a broken body and 413 for an oversized one, without a stack trace", async () => {
    const { token } = await registerUser();

    const broken = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send("{ not json");
    expect(broken.status).toBe(400);
    expect(broken.body).toEqual({ error: "Invalid JSON" });
    expect(broken.text).not.toMatch(/at .*\.(js|ts)/);

    const huge = await authed(token).post("/api/projects").send({ name: "p", padding: "x".repeat(200_000) });
    expect(huge.status).toBe(413);
  });

  it("answers JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

describe("security: passwords", () => {
  it("requires 8 to 72 characters on register, change and reset", async () => {
    const seven = "a".repeat(7);
    const tooLong = "a".repeat(73);
    const register = (password: string) =>
      request(app).post("/api/auth/register").send({ email: uniqueEmail(), password, name: "P" });

    expect((await register(seven)).status).toBe(400);
    expect((await register(tooLong)).status).toBe(400);
    expect((await register("a".repeat(8))).status).toBe(201);

    const { token } = await registerUser({ password: "current-password" });
    const change = await authed(token).post("/api/auth/change-password").send({ currentPassword: "current-password", newPassword: seven });
    expect(change.status).toBe(400);

    const reset = await request(app).post("/api/auth/reset-password").send({ token: "whatever", password: seven });
    expect(reset.status).toBe(400);
  });
});

describe("security: session tokens", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const call = (token: string) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

  it("rejects a token signed with another secret", async () => {
    expect((await call(jwt.sign({ userId }, "not-the-secret"))).status).toBe(401);
  });

  it("rejects an unsigned token (alg none) and other algorithms", async () => {
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ userId })).toString("base64url")}.`;
    expect((await call(unsigned)).status).toBe(401);
    expect((await call(jwt.sign({ userId }, SECRET, { algorithm: "HS512" }))).status).toBe(401);
  });

  it("rejects an expired token and a token without a user id", async () => {
    const { user } = await registerUser();
    expect((await call(jwt.sign({ userId: user.id }, SECRET, { expiresIn: -10 }))).status).toBe(401);
    expect((await call(jwt.sign({ somethingElse: true }, SECRET))).status).toBe(401);
    expect((await call(jwt.sign({ userId: 12345 }, SECRET))).status).toBe(401);
  });

  it("accepts a genuine token (control)", async () => {
    const { token } = await registerUser();
    expect((await call(token)).status).toBe(200);
  });
});

describe("security: responses", () => {
  it("sets protective headers and doesn't advertise Express", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("hides internal errors: a failing database call yields a generic 500 and the server keeps running", async () => {
    const { token } = await registerUser();
    const spy = vi.spyOn(prisma.tag, "findMany").mockRejectedValueOnce(new Error("relation secret_table does not exist"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await authed(token).get("/api/tags");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(res.text).not.toContain("secret_table");
    expect((await authed(token).get("/api/tags")).status).toBe(200);

    spy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("security: rate limiting", () => {
  // The other test files run with the limiters off; switch them on for this block only
  beforeAll(() => {
    process.env.RATE_LIMIT_DISABLED = "false";
  });
  afterAll(() => {
    process.env.RATE_LIMIT_DISABLED = "true";
  });

  it("locks an account's login after 10 wrong passwords, without affecting other accounts", async () => {
    const { user } = await registerUser({ password: "correct-horse-battery" });
    const other = await registerUser({ password: "another-password" });
    const login = (email: string, password: string) => request(app).post("/api/auth/login").send({ email, password });

    for (let i = 0; i < 10; i++) {
      expect((await login(user.email, `wrong-guess-${i}`)).status).toBe(401);
    }
    const blocked = await login(user.email, "wrong-again");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Trop de tentatives/);
    // Even the right password waits: otherwise the lock would be pointless
    expect((await login(user.email, "correct-horse-battery")).status).toBe(429);

    expect((await login(other.user.email, "another-password")).status).toBe(200);
  });

  it("successful logins don't use up the quota", async () => {
    const { user } = await registerUser({ password: "correct-horse-battery" });
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "correct-horse-battery" });
      expect(res.status).toBe(200);
    }
  });

  it("limits reset emails to 3 per address per hour, always answering the same way before that", async () => {
    const { user } = await registerUser();
    const ask = (email: string) => request(app).post("/api/auth/forgot-password").send({ email });

    for (let i = 0; i < 3; i++) expect((await ask(user.email)).status).toBe(200);
    expect((await ask(user.email)).status).toBe(429);
    // Another address is unaffected
    expect((await ask(uniqueEmail())).status).toBe(200);
  });

  it("limits wrong current-password guesses on the change-password route", async () => {
    const { token } = await registerUser({ password: "current-password" });
    const change = (currentPassword: string) =>
      authed(token).post("/api/auth/change-password").send({ currentPassword, newPassword: "brand-new-password" });

    for (let i = 0; i < 10; i++) expect((await change(`guess-${i}-xxxx`)).status).toBe(400);
    expect((await change("current-password")).status).toBe(429);
  });
});
