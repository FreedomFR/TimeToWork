import { describe, expect, it } from "vitest";
import { authed, registerUser, request, app } from "./helpers";

async function createClient(token: string, name = "Acme Corp") {
  const res = await authed(token).post("/api/clients").send({ name });
  return res.body;
}

describe("projects", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("starts empty for a new user", async () => {
    const { token } = await registerUser();
    const res = await authed(token).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creates a project with default color when none is given", async () => {
    const { token } = await registerUser();
    const res = await authed(token).post("/api/projects").send({ name: "Website" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Website", color: "#03A9F4", archived: false, clientId: null });
  });

  it("creates a project with a custom color and client", async () => {
    const { token } = await registerUser();
    const client = await createClient(token);

    const res = await authed(token)
      .post("/api/projects")
      .send({ name: "Rebrand", color: "#E91E63", clientId: client.id });

    expect(res.status).toBe(201);
    expect(res.body.color).toBe("#E91E63");
    expect(res.body.client).toMatchObject({ id: client.id, name: "Acme Corp" });
  });

  it("rejects a project without a name", async () => {
    const { token } = await registerUser();
    const res = await authed(token).post("/api/projects").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("lists a user's own projects alphabetically", async () => {
    const { token } = await registerUser();
    await authed(token).post("/api/projects").send({ name: "Zeta" });
    await authed(token).post("/api/projects").send({ name: "Alpha" });

    const res = await authed(token).get("/api/projects");
    expect(res.body.map((p: any) => p.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("does not show another user's projects", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();

    await authed(tokenA).post("/api/projects").send({ name: "Only mine" });

    const res = await authed(tokenB).get("/api/projects");
    expect(res.body).toEqual([]);
  });

  it("updates name, color, archived state and client", async () => {
    const { token } = await registerUser();
    const client = await createClient(token);
    const created = await authed(token).post("/api/projects").send({ name: "Draft" });

    const res = await authed(token)
      .put(`/api/projects/${created.body.id}`)
      .send({ name: "Final", color: "#4CAF50", archived: true, clientId: client.id });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Final",
      color: "#4CAF50",
      archived: true,
      clientId: client.id,
    });
  });

  it("partially updates without clobbering other fields", async () => {
    const { token } = await registerUser();
    const created = await authed(token)
      .post("/api/projects")
      .send({ name: "Draft", color: "#4CAF50" });

    const res = await authed(token).put(`/api/projects/${created.body.id}`).send({ archived: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Draft", color: "#4CAF50", archived: true });
  });

  it("404s updating a project that does not belong to the user", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    const created = await authed(tokenA).post("/api/projects").send({ name: "Private" });

    const res = await authed(tokenB).put(`/api/projects/${created.body.id}`).send({ name: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("does not lose a field update when two requests patch different fields concurrently", async () => {
    const { token } = await registerUser();
    const created = await authed(token)
      .post("/api/projects")
      .send({ name: "Draft", color: "#03A9F4" });

    await Promise.all([
      authed(token).put(`/api/projects/${created.body.id}`).send({ name: "Renamed" }),
      authed(token).put(`/api/projects/${created.body.id}`).send({ color: "#4CAF50" }),
    ]);

    const list = await authed(token).get("/api/projects");
    const project = list.body.find((p: any) => p.id === created.body.id);
    expect(project).toMatchObject({ name: "Renamed", color: "#4CAF50" });
  });

  it("deletes a project", async () => {
    const { token } = await registerUser();
    const created = await authed(token).post("/api/projects").send({ name: "Temp" });

    const del = await authed(token).delete(`/api/projects/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await authed(token).get("/api/projects");
    expect(list.body).toEqual([]);
  });

  it("404s deleting a project that does not belong to the user", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    const created = await authed(tokenA).post("/api/projects").send({ name: "Private" });

    const res = await authed(tokenB).delete(`/api/projects/${created.body.id}`);
    expect(res.status).toBe(404);
  });
});
