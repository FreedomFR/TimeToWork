import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app, authed, registerUser, request, uniqueEmail } from "./helpers";
import { prisma } from "../src/lib/prisma";
import { flushLogs, logEvent, purgeOldLogs } from "../src/lib/logger";

/** A registered account that has been given the admin role directly in the database. */
async function registerAdmin() {
  const account = await registerUser();
  await prisma.user.update({ where: { id: account.user.id }, data: { role: "ADMIN" } });
  return account;
}

/** Log entries of an account, once pending writes are done. */
async function logsOf(userId: string, type?: string) {
  await flushLogs();
  return prisma.logEntry.findMany({ where: { userId, type }, orderBy: { createdAt: "asc" } });
}

/** Makes `admin` the only admin of the whole database (roles are global). */
async function beOnlyAdmin(adminId: string) {
  await prisma.user.updateMany({ where: { role: "ADMIN", id: { not: adminId } }, data: { role: "USER" } });
}

const ROUTES: [string, string][] = [
  ["get", "/api/admin/users"],
  ["get", "/api/admin/logs"],
  ["get", "/api/admin/logs/summary"],
  ["put", `/api/admin/users/${"00000000-0000-4000-8000-000000000000"}/role`],
];

describe("admin: access control", () => {
  it("answers 401 to visitors who are not signed in", async () => {
    for (const [method, url] of ROUTES) {
      const res = await (request(app) as any)[method](url).send({ role: "ADMIN" });
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });

  it("answers 403 to a regular user on every admin route, and journals the attempt", async () => {
    const { token, user } = await registerUser();

    for (const [method, url] of ROUTES) {
      const res = await (authed(token) as any)[method](url).send({ role: "ADMIN" });
      expect(res.status, `${method} ${url}`).toBe(403);
    }

    const forbidden = await logsOf(user.id, "forbidden");
    expect(forbidden).toHaveLength(ROUTES.length);
    expect(forbidden[0]).toMatchObject({ level: "warn", statusCode: 403, userEmail: user.email });
  });

  it("lets an admin in", async () => {
    const { token } = await registerAdmin();
    for (const url of ["/api/admin/users", "/api/admin/logs", "/api/admin/logs/summary"]) {
      expect((await authed(token).get(url)).status, url).toBe(200);
    }
  });

  it("reports the role on login, register and /me", async () => {
    const email = uniqueEmail();
    const registered = await request(app).post("/api/auth/register").send({ email, password: "password123", name: "R" });
    expect(registered.body.user.role).toBe("USER");

    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    expect(login.body.user.role).toBe("ADMIN");
    const me = await authed(login.body.token).get("/api/auth/me");
    expect(me.body.role).toBe("ADMIN");
  });

  it("cannot be obtained by asking for it at registration", async () => {
    const email = uniqueEmail();
    const res = await request(app).post("/api/auth/register").send({ email, password: "password123", name: "Sneaky", role: "ADMIN" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("USER");
    expect((await prisma.user.findUnique({ where: { email } }))?.role).toBe("USER");
  });
});

describe("admin: roles", () => {
  it("promotes a user, whose existing session gains access at once", async () => {
    const admin = await registerAdmin();
    const other = await registerUser();
    expect((await authed(other.token).get("/api/admin/users")).status).toBe(403);

    const res = await authed(admin.token).put(`/api/admin/users/${other.user.id}/role`).send({ role: "ADMIN" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: other.user.id, email: other.user.email, role: "ADMIN", entryCount: 0 });
    // Same token as before: the role is read from the database, not from the token
    expect((await authed(other.token).get("/api/admin/users")).status).toBe(200);
  });

  it("demotes an admin, who loses access at once", async () => {
    const admin = await registerAdmin();
    const other = await registerAdmin();
    expect((await authed(other.token).get("/api/admin/users")).status).toBe(200);

    const res = await authed(admin.token).put(`/api/admin/users/${other.user.id}/role`).send({ role: "USER" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("USER");
    expect((await authed(other.token).get("/api/admin/users")).status).toBe(403);
  });

  it("keeps an audit trail of role changes, and nothing for a no-op", async () => {
    const admin = await registerAdmin();
    const other = await registerUser();

    await authed(admin.token).put(`/api/admin/users/${other.user.id}/role`).send({ role: "ADMIN" });
    await authed(admin.token).put(`/api/admin/users/${other.user.id}/role`).send({ role: "ADMIN" }); // already admin

    const audit = await logsOf(admin.user.id, "admin_action");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ level: "info", userEmail: admin.user.email });
    expect(audit[0].message).toContain(other.user.email);
    expect(JSON.parse(audit[0].details!)).toMatchObject({ targetId: other.user.id, from: "USER", to: "ADMIN" });
  });

  it("refuses to demote the last admin, even for themselves", async () => {
    const admin = await registerAdmin();
    await beOnlyAdmin(admin.user.id);

    const res = await authed(admin.token).put(`/api/admin/users/${admin.user.id}/role`).send({ role: "USER" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dernier administrateur/);
    expect((await prisma.user.findUnique({ where: { id: admin.user.id } }))?.role).toBe("ADMIN");
  });

  it("lets an admin step down once another admin exists", async () => {
    const admin = await registerAdmin();
    const successor = await registerUser();
    await beOnlyAdmin(admin.user.id);

    await authed(admin.token).put(`/api/admin/users/${successor.user.id}/role`).send({ role: "ADMIN" });
    const res = await authed(admin.token).put(`/api/admin/users/${admin.user.id}/role`).send({ role: "USER" });

    expect(res.status).toBe(200);
    expect((await authed(admin.token).get("/api/admin/users")).status).toBe(403);
    expect((await authed(successor.token).get("/api/admin/users")).status).toBe(200);
  });

  it("two admins demoting each other at the same time cannot leave the app without an admin", async () => {
    const a = await registerAdmin();
    const b = await registerAdmin();
    await beOnlyAdmin(a.user.id);
    await prisma.user.update({ where: { id: b.user.id }, data: { role: "ADMIN" } });

    await Promise.all([
      authed(a.token).put(`/api/admin/users/${b.user.id}/role`).send({ role: "USER" }),
      authed(b.token).put(`/api/admin/users/${a.user.id}/role`).send({ role: "USER" }),
    ]);

    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBeGreaterThanOrEqual(1);
  });

  it("rejects an unknown user and an invalid role", async () => {
    const admin = await registerAdmin();
    const other = await registerUser();

    const unknown = await authed(admin.token).put("/api/admin/users/00000000-0000-4000-8000-000000000000/role").send({ role: "ADMIN" });
    expect(unknown.status).toBe(404);
    for (const role of ["SUPERUSER", "admin", "", 1, null]) {
      const res = await authed(admin.token).put(`/api/admin/users/${other.user.id}/role`).send({ role });
      expect(res.status, String(role)).toBe(400);
    }
  });

  it("a regular user cannot promote themselves", async () => {
    const { token, user } = await registerUser();
    const res = await authed(token).put(`/api/admin/users/${user.id}/role`).send({ role: "ADMIN" });
    expect(res.status).toBe(403);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.role).toBe("USER");
  });

  it("lists users with their role, searchable, without any secret", async () => {
    const admin = await registerAdmin();
    const marker = `Needle${Date.now()}`;
    const found = await registerUser({ name: marker });

    const res = await authed(admin.token).get(`/api/admin/users?search=${marker.toLowerCase()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: found.user.id, role: "USER", entryCount: 0 });
    expect(Object.keys(res.body[0]).sort()).toEqual(["createdAt", "email", "entryCount", "id", "name", "role"]);
  });
});

describe("admin: what gets journaled", () => {
  it("stores server errors with their stack and the account, but tells the client nothing", async () => {
    const { token, user } = await registerUser();
    const spy = vi.spyOn(prisma.tag, "findMany").mockRejectedValueOnce(new Error("connection to secret-db refused"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await authed(token).get("/api/tags");
    spy.mockRestore();
    consoleSpy.mockRestore();

    expect(res.body).toEqual({ error: "Internal server error" });
    const [entry] = await logsOf(user.id, "server_error");
    expect(entry).toMatchObject({ level: "error", statusCode: 500, method: "GET", path: "/api/tags" });
    expect(entry.message).toContain("secret-db refused");
    expect(entry.details).toContain("Error: connection to secret-db refused");
  });

  it("stores failed logins with the account concerned, never the password tried", async () => {
    const { user } = await registerUser({ password: "the-real-password" });
    const unknown = uniqueEmail();

    await request(app).post("/api/auth/login").send({ email: user.email, password: "hunter2-wrong-guess" });
    await request(app).post("/api/auth/login").send({ email: unknown, password: "hunter2-wrong-guess" });

    const known = await logsOf(user.id, "auth_failed");
    expect(known).toHaveLength(1);
    expect(known[0]).toMatchObject({ level: "warn", statusCode: 401, userEmail: user.email, message: "Mot de passe incorrect" });

    await flushLogs();
    const forUnknown = await prisma.logEntry.findMany({ where: { userEmail: unknown } });
    expect(forUnknown).toHaveLength(1);
    expect(forUnknown[0]).toMatchObject({ userId: null, message: "Email inconnu" });

    // The password guess appears nowhere in the journal
    const leaks = await prisma.logEntry.findMany({
      where: { OR: [{ message: { contains: "hunter2" } }, { details: { contains: "hunter2" } }, { path: { contains: "hunter2" } }] },
    });
    expect(leaks).toHaveLength(0);
  });

  it("stores which field was refused by validation, never the value sent", async () => {
    const { token, user } = await registerUser();
    const secretValue = "S3CRET-".repeat(400); // over the 2000-character limit

    const res = await authed(token).post("/api/time-entries").send({ description: secretValue, start: "2026-09-23T09:00:00.000Z" });
    expect(res.status).toBe(400);

    const [entry] = await logsOf(user.id, "validation_error");
    expect(entry).toMatchObject({ level: "info", statusCode: 400, method: "POST", path: "/api/time-entries" });
    expect(entry.details).toContain("description");
    expect(entry.details).not.toContain("S3CRET");
  });

  it("stores a refused change of password and a bad reset link as failed authentications", async () => {
    const { token, user } = await registerUser({ password: "current-password" });
    await authed(token).post("/api/auth/change-password").send({ currentPassword: "nope-nope-nope", newPassword: "another-password" });
    await request(app).post("/api/auth/reset-password").send({ token: "invalid", password: "whatever-password" });

    const entries = await logsOf(user.id, "auth_failed");
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toMatch(/mot de passe actuel incorrect/);
  });

  describe("with rate limits switched on", () => {
    beforeAll(() => {
      process.env.RATE_LIMIT_DISABLED = "false";
    });
    afterAll(() => {
      process.env.RATE_LIMIT_DISABLED = "true";
    });

    it("stores a hit rate limit", async () => {
      const { user } = await registerUser();
      for (let i = 0; i < 4; i++) await request(app).post("/api/auth/forgot-password").send({ email: user.email });

      await flushLogs();
      const entries = await prisma.logEntry.findMany({ where: { type: "rate_limited", path: "/api/auth/forgot-password" }, orderBy: { createdAt: "desc" }, take: 1 });
      expect(entries[0]).toMatchObject({ level: "warn", statusCode: 429, method: "POST" });
    });

    it("limits how fast one user can report browser errors", async () => {
      const { token } = await registerUser();
      const statuses: number[] = [];
      for (let i = 0; i < 32; i++) statuses.push((await authed(token).post("/api/logs/client").send({ message: `boom ${i}` })).status);

      expect(statuses.slice(0, 30).every((s) => s === 204)).toBe(true);
      expect(statuses.slice(30)).toEqual([429, 429]);
    });
  });

  it("stores browser errors reported by a signed-in user, and only those", async () => {
    const { token, user } = await registerUser();
    expect((await request(app).post("/api/logs/client").send({ message: "anonymous" })).status).toBe(401);

    const res = await authed(token)
      .post("/api/logs/client")
      .send({ message: "Cannot read properties of undefined", stack: "TypeError: x\n    at f (app.js:1:1)", url: "http://localhost:8080/reports?token=abc#frag", kind: "react" });
    expect(res.status).toBe(204);

    const [entry] = await logsOf(user.id, "client_error");
    expect(entry).toMatchObject({ level: "error", method: "BROWSER", path: "http://localhost:8080/reports", message: "Cannot read properties of undefined" });
    expect(JSON.parse(entry.details!)).toMatchObject({ kind: "react" });
    expect(JSON.stringify(entry)).not.toContain("token=abc");
  });

  it("bounds what a browser can report", async () => {
    const { token } = await registerUser();
    expect((await authed(token).post("/api/logs/client").send({ message: "x".repeat(501) })).status).toBe(400);
    expect((await authed(token).post("/api/logs/client").send({ message: "ok", stack: "x".repeat(4001) })).status).toBe(400);
    expect((await authed(token).post("/api/logs/client").send({ message: "ok", kind: "weird" })).status).toBe(400);
    expect((await authed(token).post("/api/logs/client").send({})).status).toBe(400);
  });

  it("truncates oversized fields and never fails the caller", async () => {
    const { user } = await registerUser();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logEvent({ level: "error", type: "server_error", message: "m".repeat(2000), details: "d".repeat(20000), userId: user.id });
    logEvent({ level: "info", type: "admin_action", message: "bad user", userId: "not-an-existing-user" }); // foreign key error, swallowed
    await flushLogs();
    consoleSpy.mockRestore();

    const [entry] = await prisma.logEntry.findMany({ where: { userId: user.id } });
    expect(entry.message.length).toBeLessThanOrEqual(500);
    expect(entry.details!.length).toBeLessThanOrEqual(4000);
  });

  it("purges only the entries older than the retention", async () => {
    const marker = `purge-${Date.now()}`;
    const day = 24 * 60 * 60 * 1000;
    await prisma.logEntry.createMany({
      data: [
        { level: "info", type: "admin_action", message: `${marker} old`, createdAt: new Date(Date.now() - 40 * day) },
        { level: "info", type: "admin_action", message: `${marker} recent`, createdAt: new Date(Date.now() - 5 * day) },
      ],
    });

    await purgeOldLogs(30);

    const left = await prisma.logEntry.findMany({ where: { message: { startsWith: marker } } });
    expect(left.map((l) => l.message)).toEqual([`${marker} recent`]);
  });
});

describe("admin: reading the journal", () => {
  /** Inserts a known set of entries, all carrying a unique marker so other tests' entries don't interfere. */
  async function seed() {
    const marker = `seed${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const at = (d: number) => new Date(Date.UTC(2026, 0, d, 12));
    const rows = [
      { level: "error", type: "server_error", user: alice, day: 1, message: "crash A" },
      { level: "error", type: "client_error", user: alice, day: 2, message: "ui crash B" },
      { level: "warn", type: "auth_failed", user: bob, day: 3, message: "login C" },
      { level: "warn", type: "rate_limited", user: bob, day: 4, message: "limit D" },
      { level: "info", type: "validation_error", user: alice, day: 5, message: "invalid E" },
    ];
    await prisma.logEntry.createMany({
      data: rows.map((r) => ({
        level: r.level,
        type: r.type,
        message: `${marker} ${r.message}`,
        userId: r.user.user.id,
        userEmail: r.user.user.email,
        createdAt: at(r.day),
        path: `/api/${r.type}`,
        details: `${marker} details of ${r.message}`,
      })),
    });
    const admin = await registerAdmin();
    const list = async (params: Record<string, string | number> = {}) => {
      const qs = new URLSearchParams({ q: marker, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
      return authed(admin.token).get(`/api/admin/logs?${qs}`);
    };
    return { marker, alice, bob, admin, list };
  }

  it("lists newest first by default, with the account's name", async () => {
    const { list, alice } = await seed();
    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 25, totalPages: 1 });
    expect(res.body.items.map((i: any) => i.message.split(" ").slice(1).join(" "))).toEqual(["invalid E", "limit D", "login C", "ui crash B", "crash A"]);
    expect(res.body.items[0].user).toMatchObject({ id: alice.user.id, name: "Alice" });
    expect(res.body.items[0].user).not.toHaveProperty("password");
  });

  it("filters by person", async () => {
    const { list, alice, bob } = await seed();
    expect((await list({ userId: alice.user.id })).body.total).toBe(3);
    expect((await list({ userId: bob.user.id })).body.total).toBe(2);
  });

  it("filters by type of bug and by level", async () => {
    const { list } = await seed();
    const server = await list({ type: "server_error" });
    expect(server.body.total).toBe(1);
    expect(server.body.items[0].type).toBe("server_error");
    expect((await list({ level: "warn" })).body.total).toBe(2);
    expect((await list({ level: "error", type: "client_error" })).body.total).toBe(1);
    expect((await list({ level: "info", type: "server_error" })).body.total).toBe(0);
  });

  it("filters by period", async () => {
    const { list } = await seed();
    const res = await list({ from: "2026-01-02T00:00:00.000Z", to: "2026-01-04T23:59:59.999Z" });
    expect(res.body.total).toBe(3);
  });

  it("searches the message, route, email and details", async () => {
    const { marker, admin, alice } = await seed();
    const search = async (q: string) => (await authed(admin.token).get(`/api/admin/logs?q=${encodeURIComponent(q)}`)).body.total;

    expect(await search(`${marker} crash`)).toBe(1); // message "crash A"
    expect(await search(`${marker} ui crash`)).toBe(1); // message "ui crash B"
    expect(await search(marker)).toBe(5);
    expect(await search(marker.toUpperCase())).toBe(5); // case-insensitive
    expect(await search(`/api/rate_limited`)).toBeGreaterThanOrEqual(1);
    expect(await search(alice.user.email)).toBe(3);
    expect(await search(`${marker} details of invalid E`)).toBe(1);
  });

  it("sorts by date, person, type and level, both ways", async () => {
    const { list } = await seed();
    expect((await list({ sort: "date", order: "asc" })).body.items.map((i: any) => i.type)).toEqual([
      "server_error", "client_error", "auth_failed", "rate_limited", "validation_error",
    ]);
    expect((await list({ sort: "type", order: "asc" })).body.items.map((i: any) => i.type)).toEqual([
      "auth_failed", "client_error", "rate_limited", "server_error", "validation_error",
    ]);
    expect((await list({ sort: "type", order: "desc" })).body.items.map((i: any) => i.type)).toEqual([
      "validation_error", "server_error", "rate_limited", "client_error", "auth_failed",
    ]);
    // by person: Alice's three entries (newest first inside), then Bob's two — or the reverse
    const byUser = (await list({ sort: "user", order: "asc" })).body.items.map((i: any) => i.user.name);
    expect(byUser).toHaveLength(5);
    expect(new Set(byUser.slice(0, 3)).size).toBe(1);
    expect(new Set(byUser.slice(3)).size).toBe(1);
    const reversed = (await list({ sort: "user", order: "desc" })).body.items.map((i: any) => i.user.name);
    expect(reversed[0]).not.toBe(byUser[0]);
    // by level, alphabetical: error, info, warn
    const levels = (await list({ sort: "level", order: "asc" })).body.items.map((i: any) => i.level);
    expect(levels).toEqual(["error", "error", "info", "warn", "warn"]);
  });

  it("paginates", async () => {
    const { list } = await seed();
    const first = await list({ pageSize: 2, page: 1 });
    const third = await list({ pageSize: 2, page: 3 });
    const beyond = await list({ pageSize: 2, page: 9 });

    expect(first.body).toMatchObject({ total: 5, totalPages: 3, pageSize: 2 });
    expect(first.body.items).toHaveLength(2);
    expect(third.body.items).toHaveLength(1);
    expect(beyond.body.items).toHaveLength(0);
  });

  it("refuses invalid parameters", async () => {
    const { list } = await seed();
    for (const bad of [
      { type: "made_up" }, { level: "fatal" }, { userId: "not-a-uuid" }, { sort: "password" },
      { order: "sideways" }, { page: 0 }, { pageSize: 0 }, { pageSize: 101 }, { from: "garbage" },
    ]) {
      expect((await list(bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("treats search text as data, not as a query", async () => {
    const { admin } = await seed();
    const res = await authed(admin.token).get(`/api/admin/logs?q=${encodeURIComponent("'; DROP TABLE \"LogEntry\"; --")}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect((await authed(admin.token).get("/api/admin/logs")).status).toBe(200); // table still there
  });

  it("summarizes counts per type and level", async () => {
    const { marker, admin } = await seed();
    const res = await authed(admin.token).get(`/api/admin/logs/summary?q=${marker}`);

    expect(res.status).toBe(200);
    expect(res.body.byType).toEqual({ server_error: 1, client_error: 1, auth_failed: 1, rate_limited: 1, validation_error: 1 });
    expect(res.body.byLevel).toEqual({ error: 2, warn: 2, info: 1 });
    expect(res.body.types).toContain("admin_action");
  });

  it("keeps a deleted account's entries, still readable by email", async () => {
    const { list, alice } = await seed();
    await prisma.user.delete({ where: { id: alice.user.id } });

    const res = await list({ q: alice.user.email });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.items[0].user).toBeNull();
    expect(res.body.items[0].userEmail).toBe(alice.user.email);
  });
});
