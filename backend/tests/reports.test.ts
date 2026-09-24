import { describe, expect, it } from "vitest";
import { authed, registerUser, request, app } from "./helpers";

describe("reports: summary", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/reports/summary");
    expect(res.status).toBe(401);
  });

  it("returns zero for a user with no entries", async () => {
    const { token } = await registerUser();
    const res = await authed(token).get("/api/reports/summary");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalSeconds: 0, byProject: [] });
  });

  it("sums durations per project and overall, ignoring running entries", async () => {
    const { token } = await registerUser();
    const projectA = await authed(token).post("/api/projects").send({ name: "A", color: "#111111" });
    const projectB = await authed(token).post("/api/projects").send({ name: "B", color: "#222222" });

    // 1 hour on project A
    await authed(token)
      .post("/api/time-entries")
      .send({ projectId: projectA.body.id, start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });
    // 30 more minutes on project A
    await authed(token)
      .post("/api/time-entries")
      .send({ projectId: projectA.body.id, start: "2025-01-01T09:00:00.000Z", end: "2025-01-01T09:30:00.000Z" });
    // 2 hours on project B
    await authed(token)
      .post("/api/time-entries")
      .send({ projectId: projectB.body.id, start: "2025-01-02T08:00:00.000Z", end: "2025-01-02T10:00:00.000Z" });
    // no project
    await authed(token)
      .post("/api/time-entries")
      .send({ start: "2025-01-03T08:00:00.000Z", end: "2025-01-03T08:15:00.000Z" });
    // still running — must be excluded from totals
    await authed(token).post("/api/time-entries/start").send({ description: "Running" });

    const res = await authed(token).get("/api/reports/summary");
    expect(res.status).toBe(200);
    expect(res.body.totalSeconds).toBe(3600 + 1800 + 7200 + 900);

    const byProject = res.body.byProject;
    expect(byProject[0]).toMatchObject({ projectId: projectB.body.id, name: "B", seconds: 7200 });
    expect(byProject[1]).toMatchObject({ projectId: projectA.body.id, name: "A", seconds: 5400 });
    expect(byProject[2]).toMatchObject({ projectId: null, name: "Aucun projet", seconds: 900 });
  });

  it("filters by date range", async () => {
    const { token } = await registerUser();
    await authed(token)
      .post("/api/time-entries")
      .send({ description: "Before", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });
    await authed(token)
      .post("/api/time-entries")
      .send({ description: "In range", start: "2025-01-10T08:00:00.000Z", end: "2025-01-10T09:00:00.000Z" });

    const res = await authed(token)
      .get("/api/reports/summary")
      .query({ from: "2025-01-05", to: "2025-01-15" });

    expect(res.body.totalSeconds).toBe(3600);
  });

  it("does not include another user's entries", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    await authed(tokenA)
      .post("/api/time-entries")
      .send({ start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });

    const res = await authed(tokenB).get("/api/reports/summary");
    expect(res.body).toEqual({ totalSeconds: 0, byProject: [] });
  });
});
