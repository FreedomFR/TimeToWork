import { describe, expect, it } from "vitest";
import { app, authed, registerUser, request, uniqueEmail } from "./helpers";
import { prisma } from "../src/lib/prisma";
import { readPreferences } from "../src/lib/preferences";

/** Per-user display settings: animations on/off, text size. */

const DEFAULTS = { animations: true, textSize: "normal" };
const save = (token: string, body: unknown) => authed(token).put("/api/auth/preferences").send(body as object);

describe("preferences: reading", () => {
  it("gives the defaults to a new account, in the sign-up response and in /me", async () => {
    const email = uniqueEmail();
    const res = await request(app).post("/api/auth/register").send({ email, password: "password123", name: "New" });
    expect(res.body.user.preferences).toEqual(DEFAULTS);

    const me = await authed(res.body.token).get("/api/auth/me");
    expect(me.body.preferences).toEqual(DEFAULTS);
  });

  it("comes back with the sign-in, on any device", async () => {
    const { user, token } = await registerUser({ password: "password123" });
    await save(token, { animations: false, textSize: "large" });

    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "password123" });
    expect(login.body.user.preferences).toEqual({ animations: false, textSize: "large" });
  });
});

describe("preferences: saving", () => {
  it("saves and returns the settings", async () => {
    const { token } = await registerUser();
    const res = await save(token, { animations: false, textSize: "xlarge" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ animations: false, textSize: "xlarge" });
    expect((await authed(token).get("/api/auth/me")).body.preferences).toEqual({ animations: false, textSize: "xlarge" });
  });

  it("changes only what is sent and keeps the rest", async () => {
    const { token } = await registerUser();
    await save(token, { animations: false });
    const res = await save(token, { textSize: "large" });
    expect(res.body).toEqual({ animations: false, textSize: "large" });
  });

  it("accepts an empty update (nothing changes)", async () => {
    const { token } = await registerUser();
    expect((await save(token, {})).body).toEqual(DEFAULTS);
  });

  it("does not touch the settings of other users", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await save(a.token, { animations: false, textSize: "xlarge" });
    expect((await authed(b.token).get("/api/auth/me")).body.preferences).toEqual(DEFAULTS);
  });

  it("needs a signed-in user", async () => {
    expect((await request(app).put("/api/auth/preferences").send({ animations: false })).status).toBe(401);
  });

  it.each([
    ["an unknown text size", { textSize: "huge" }],
    ["animations that are not a boolean", { animations: "yes" }],
    ["a null value", { animations: null }],
    ["an unknown setting", { theme: "light" }],
    ["a setting that could change something else", { role: "ADMIN" }],
    ["an array", [{ animations: false }]],
  ])("refuses %s", async (_label, body) => {
    const { token } = await registerUser();
    const res = await save(token, body);
    expect(res.status).toBe(400);
    expect((await authed(token).get("/api/auth/me")).body.preferences).toEqual(DEFAULTS);
  });

  it("cannot be used to become an admin", async () => {
    const { token } = await registerUser();
    await save(token, { role: "ADMIN" });
    expect((await authed(token).get("/api/auth/me")).body.role).toBe("USER");
  });
});

describe("preferences: bad stored data never locks anybody out", () => {
  it("falls back to the defaults for missing or invalid stored values", () => {
    expect(readPreferences(undefined)).toEqual(DEFAULTS);
    expect(readPreferences(null)).toEqual(DEFAULTS);
    expect(readPreferences("garbage")).toEqual(DEFAULTS);
    expect(readPreferences([1, 2])).toEqual(DEFAULTS);
    expect(readPreferences({ animations: "no", textSize: "gigantic" })).toEqual(DEFAULTS);
  });

  it("keeps the valid values and drops removed settings", () => {
    expect(readPreferences({ animations: false, textSize: "nope", oldSetting: 1 })).toEqual({ animations: false, textSize: "normal" });
  });

  it("still signs in a user whose stored settings were corrupted", async () => {
    const { user, token } = await registerUser({ password: "password123" });
    await prisma.user.update({ where: { id: user.id }, data: { preferences: { animations: 42, textSize: [] } } });

    const me = await authed(token).get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.preferences).toEqual(DEFAULTS);
    expect((await request(app).post("/api/auth/login").send({ email: user.email, password: "password123" })).status).toBe(200);
  });
});
