import { describe, expect, it } from "vitest";
import { authed, registerUser, request, app } from "./helpers";

async function setupProjectAndTag(token: string) {
  const project = await authed(token).post("/api/projects").send({ name: "Website" });
  const tag = await authed(token).post("/api/tags").send({ name: "urgent" });
  return { project: project.body, tag: tag.body };
}

describe("time entries: auth", () => {
  it("requires authentication on every route", async () => {
    expect((await request(app).get("/api/time-entries")).status).toBe(401);
    expect((await request(app).get("/api/time-entries/current")).status).toBe(401);
    expect((await request(app).post("/api/time-entries/start")).status).toBe(401);
    expect((await request(app).post("/api/time-entries")).status).toBe(401);
  });
});

describe("time entries: timer", () => {
  it("has no running entry for a fresh user", async () => {
    const { token } = await registerUser();
    const res = await authed(token).get("/api/time-entries/current");
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("starts a timer with description, project, tags and billable", async () => {
    const { token } = await registerUser();
    const { project, tag } = await setupProjectAndTag(token);

    const res = await authed(token)
      .post("/api/time-entries/start")
      .send({ description: "Writing tests", projectId: project.id, tagIds: [tag.id], billable: true });

    expect(res.status).toBe(201);
    expect(res.body.end).toBeNull();
    expect(res.body.description).toBe("Writing tests");
    expect(res.body.project.id).toBe(project.id);
    expect(res.body.billable).toBe(true);
    expect(res.body.tags).toEqual([{ id: tag.id, name: "urgent", userId: expect.any(String), createdAt: expect.any(String) }]);

    const current = await authed(token).get("/api/time-entries/current");
    expect(current.body.id).toBe(res.body.id);
  });

  it("starting a new timer stops the previously running one", async () => {
    const { token } = await registerUser();
    const first = await authed(token).post("/api/time-entries/start").send({ description: "First" });
    expect(first.body.end).toBeNull();

    const second = await authed(token).post("/api/time-entries/start").send({ description: "Second" });
    expect(second.body.end).toBeNull();

    const list = await authed(token).get("/api/time-entries");
    const reloadedFirst = list.body.find((e: any) => e.id === first.body.id);
    expect(reloadedFirst.end).not.toBeNull();

    const current = await authed(token).get("/api/time-entries/current");
    expect(current.body.id).toBe(second.body.id);
  });

  it("stops a running entry", async () => {
    const { token } = await registerUser();
    const started = await authed(token).post("/api/time-entries/start").send({ description: "Task" });

    const stopped = await authed(token).post(`/api/time-entries/${started.body.id}/stop`);
    expect(stopped.status).toBe(200);
    expect(stopped.body.end).not.toBeNull();

    const current = await authed(token).get("/api/time-entries/current");
    expect(current.body).toBeNull();
  });

  it("404s stopping an entry that does not belong to the user", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    const started = await authed(tokenA).post("/api/time-entries/start").send({ description: "Task" });

    const res = await authed(tokenB).post(`/api/time-entries/${started.body.id}/stop`);
    expect(res.status).toBe(404);
  });
});

describe("time entries: manual creation", () => {
  it("creates a completed manual entry", async () => {
    const { token } = await registerUser();
    const { project, tag } = await setupProjectAndTag(token);
    const start = new Date("2025-01-01T09:00:00.000Z").toISOString();
    const end = new Date("2025-01-01T10:30:00.000Z").toISOString();

    const res = await authed(token)
      .post("/api/time-entries")
      .send({ description: "Manual work", projectId: project.id, tagIds: [tag.id], billable: true, start, end });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ description: "Manual work", start, end, billable: true });
    expect(res.body.project.id).toBe(project.id);
    expect(res.body.tags.map((t: any) => t.id)).toEqual([tag.id]);
  });

  it("rejects a manual entry without a start time", async () => {
    const { token } = await registerUser();
    const res = await authed(token).post("/api/time-entries").send({ description: "No start" });
    expect(res.status).toBe(400);
  });

  it("allows a manual entry with no end (still running)", async () => {
    const { token } = await registerUser();
    const res = await authed(token)
      .post("/api/time-entries")
      .send({ description: "Open-ended", start: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.end).toBeNull();
  });
});

describe("time entries: listing", () => {
  it("orders entries by start descending", async () => {
    const { token } = await registerUser();
    const early = await authed(token)
      .post("/api/time-entries")
      .send({ description: "Early", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });
    const late = await authed(token)
      .post("/api/time-entries")
      .send({ description: "Late", start: "2025-01-02T08:00:00.000Z", end: "2025-01-02T09:00:00.000Z" });

    const res = await authed(token).get("/api/time-entries");
    expect(res.body.map((e: any) => e.id)).toEqual([late.body.id, early.body.id]);
  });

  it("filters by date range", async () => {
    const { token } = await registerUser();
    await authed(token)
      .post("/api/time-entries")
      .send({ description: "Before range", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });
    const inRange = await authed(token)
      .post("/api/time-entries")
      .send({ description: "In range", start: "2025-01-10T08:00:00.000Z", end: "2025-01-10T09:00:00.000Z" });
    await authed(token)
      .post("/api/time-entries")
      .send({ description: "After range", start: "2025-02-01T08:00:00.000Z", end: "2025-02-01T09:00:00.000Z" });

    const res = await authed(token).get("/api/time-entries").query({ from: "2025-01-05", to: "2025-01-15" });
    expect(res.body.map((e: any) => e.id)).toEqual([inRange.body.id]);
  });

  it("does not list another user's entries", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    await authed(tokenA)
      .post("/api/time-entries")
      .send({ description: "Private", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });

    const res = await authed(tokenB).get("/api/time-entries");
    expect(res.body).toEqual([]);
  });
});

describe("time entries: update", () => {
  it("updates description, billable and project", async () => {
    const { token } = await registerUser();
    const { project } = await setupProjectAndTag(token);
    const created = await authed(token)
      .post("/api/time-entries")
      .send({ description: "Draft", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });

    const res = await authed(token)
      .put(`/api/time-entries/${created.body.id}`)
      .send({ description: "Final", billable: true, projectId: project.id });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: "Final", billable: true });
    expect(res.body.project.id).toBe(project.id);
  });

  it("replaces tags entirely on update", async () => {
    const { token } = await registerUser();
    const tagA = await authed(token).post("/api/tags").send({ name: "a" });
    const tagB = await authed(token).post("/api/tags").send({ name: "b" });
    const created = await authed(token)
      .post("/api/time-entries")
      .send({
        description: "Task",
        start: "2025-01-01T08:00:00.000Z",
        end: "2025-01-01T09:00:00.000Z",
        tagIds: [tagA.body.id],
      });
    expect(created.body.tags.map((t: any) => t.id)).toEqual([tagA.body.id]);

    const res = await authed(token)
      .put(`/api/time-entries/${created.body.id}`)
      .send({ tagIds: [tagB.body.id] });

    expect(res.body.tags.map((t: any) => t.id)).toEqual([tagB.body.id]);
  });

  it("clears all tags when given an empty array", async () => {
    const { token } = await registerUser();
    const tag = await authed(token).post("/api/tags").send({ name: "a" });
    const created = await authed(token)
      .post("/api/time-entries")
      .send({
        description: "Task",
        start: "2025-01-01T08:00:00.000Z",
        end: "2025-01-01T09:00:00.000Z",
        tagIds: [tag.body.id],
      });

    const res = await authed(token).put(`/api/time-entries/${created.body.id}`).send({ tagIds: [] });
    expect(res.body.tags).toEqual([]);
  });

  it("updates start and end time", async () => {
    const { token } = await registerUser();
    const created = await authed(token)
      .post("/api/time-entries")
      .send({ description: "Task", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });

    const newStart = "2025-01-01T10:00:00.000Z";
    const newEnd = "2025-01-01T11:30:00.000Z";
    const res = await authed(token)
      .put(`/api/time-entries/${created.body.id}`)
      .send({ start: newStart, end: newEnd });

    expect(res.body.start).toBe(newStart);
    expect(res.body.end).toBe(newEnd);
  });

  it("clears the project when projectId is set to null", async () => {
    const { token } = await registerUser();
    const { project } = await setupProjectAndTag(token);
    const created = await authed(token)
      .post("/api/time-entries")
      .send({
        description: "Task",
        projectId: project.id,
        start: "2025-01-01T08:00:00.000Z",
        end: "2025-01-01T09:00:00.000Z",
      });

    const res = await authed(token).put(`/api/time-entries/${created.body.id}`).send({ projectId: null });
    expect(res.body.projectId).toBeNull();
    expect(res.body.project).toBeNull();
  });

  it("404s updating an entry that does not belong to the user", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    const created = await authed(tokenA)
      .post("/api/time-entries")
      .send({ description: "Private", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });

    const res = await authed(tokenB)
      .put(`/api/time-entries/${created.body.id}`)
      .send({ description: "Hijacked" });
    expect(res.status).toBe(404);
  });
});

describe("time entries: delete", () => {
  it("deletes an entry", async () => {
    const { token } = await registerUser();
    const created = await authed(token)
      .post("/api/time-entries")
      .send({ description: "Temp", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });

    const del = await authed(token).delete(`/api/time-entries/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await authed(token).get("/api/time-entries");
    expect(list.body).toEqual([]);
  });

  it("404s deleting an entry that does not belong to the user", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    const created = await authed(tokenA)
      .post("/api/time-entries")
      .send({ description: "Private", start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z" });

    const res = await authed(tokenB).delete(`/api/time-entries/${created.body.id}`);
    expect(res.status).toBe(404);
  });
});

describe("time entries: merge", () => {
  const at = (hhmm: string) => `2026-09-23T${hhmm}:00.000Z`;

  async function createEntry(
    token: string,
    start: string,
    end: string | null,
    overrides: Record<string, unknown> = {}
  ) {
    const res = await authed(token)
      .post("/api/time-entries")
      .send({ description: "Impression étiquette", start: at(start), end: end ? at(end) : null, ...overrides });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  it("merges contiguous entries into the earliest one, stretched to the latest end", async () => {
    const { token } = await registerUser();
    const a = await createEntry(token, "08:45", "10:00");
    const b = await createEntry(token, "10:00", "12:00");

    const res = await authed(token).post("/api/time-entries/merge").send({ ids: [b.id, a.id] });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(a.id);
    expect(res.body.start).toBe(at("08:45"));
    expect(res.body.end).toBe(at("12:00"));

    const list = await authed(token).get("/api/time-entries");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(a.id);
  });

  it("merges more than two entries at once", async () => {
    const { token } = await registerUser();
    const a = await createEntry(token, "07:50", "08:45");
    const b = await createEntry(token, "08:45", "10:00");
    const c = await createEntry(token, "10:00", "12:00");

    const res = await authed(token).post("/api/time-entries/merge").send({ ids: [a.id, b.id, c.id] });

    expect(res.status).toBe(200);
    expect(res.body.start).toBe(at("07:50"));
    expect(res.body.end).toBe(at("12:00"));
    expect((await authed(token).get("/api/time-entries")).body).toHaveLength(1);
  });

  it("keeps project, tags and billable of the merged entries", async () => {
    const { token } = await registerUser();
    const { project, tag } = await setupProjectAndTag(token);
    const extra = { projectId: project.id, tagIds: [tag.id], billable: true };
    const a = await createEntry(token, "09:00", "10:00", extra);
    const b = await createEntry(token, "10:00", "11:00", extra);

    const res = await authed(token).post("/api/time-entries/merge").send({ ids: [a.id, b.id] });

    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(project.id);
    expect(res.body.billable).toBe(true);
    expect(res.body.tags.map((t: { id: string }) => t.id)).toEqual([tag.id]);
  });

  it("refuses entries that are not the same mission, and changes nothing", async () => {
    const { token } = await registerUser();
    const { project } = await setupProjectAndTag(token);
    const a = await createEntry(token, "09:00", "10:00");
    const otherDescription = await createEntry(token, "10:00", "11:00", { description: "Autre chose" });
    const otherProject = await createEntry(token, "11:00", "12:00", { projectId: project.id });

    for (const other of [otherDescription, otherProject]) {
      const res = await authed(token).post("/api/time-entries/merge").send({ ids: [a.id, other.id] });
      expect(res.status).toBe(400);
    }
    expect((await authed(token).get("/api/time-entries")).body).toHaveLength(3);
  });

  it("refuses a running entry", async () => {
    const { token } = await registerUser();
    const finished = await createEntry(token, "09:00", "10:00");
    const running = await createEntry(token, "10:00", null);

    const res = await authed(token).post("/api/time-entries/merge").send({ ids: [finished.id, running.id] });
    expect(res.status).toBe(400);
  });

  it("needs at least two distinct entries", async () => {
    const { token } = await registerUser();
    const a = await createEntry(token, "09:00", "10:00");

    expect((await authed(token).post("/api/time-entries/merge").send({ ids: [a.id] })).status).toBe(400);
    expect((await authed(token).post("/api/time-entries/merge").send({ ids: [a.id, a.id] })).status).toBe(400);
    expect((await authed(token).post("/api/time-entries/merge").send({ ids: [] })).status).toBe(400);
  });

  it("cannot merge someone else's entries", async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    const a = await createEntry(owner.token, "09:00", "10:00");
    const b = await createEntry(owner.token, "10:00", "11:00");

    const res = await authed(intruder.token).post("/api/time-entries/merge").send({ ids: [a.id, b.id] });

    expect(res.status).toBe(404);
    expect((await authed(owner.token).get("/api/time-entries")).body).toHaveLength(2);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/time-entries/merge").send({ ids: [] });
    expect(res.status).toBe(401);
  });
});
