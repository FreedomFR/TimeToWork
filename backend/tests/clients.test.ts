import { describe, expect, it } from "vitest";
import { authed, registerUser, request, app } from "./helpers";

describe("clients", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
  });

  it("creates and lists clients alphabetically", async () => {
    const { token } = await registerUser();
    await authed(token).post("/api/clients").send({ name: "Zebra Inc" });
    await authed(token).post("/api/clients").send({ name: "Acme Corp" });

    const res = await authed(token).get("/api/clients");
    expect(res.status).toBe(200);
    expect(res.body.map((c: any) => c.name)).toEqual(["Acme Corp", "Zebra Inc"]);
  });

  it("rejects a client without a name", async () => {
    const { token } = await registerUser();
    const res = await authed(token).post("/api/clients").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("does not show another user's clients", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    await authed(tokenA).post("/api/clients").send({ name: "Only mine" });

    const res = await authed(tokenB).get("/api/clients");
    expect(res.body).toEqual([]);
  });

  it("updates name and archived state", async () => {
    const { token } = await registerUser();
    const created = await authed(token).post("/api/clients").send({ name: "Draft Co" });

    const res = await authed(token)
      .put(`/api/clients/${created.body.id}`)
      .send({ name: "Final Co", archived: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Final Co", archived: true });
  });

  it("does not lose a field update when two requests patch different fields concurrently", async () => {
    const { token } = await registerUser();
    const created = await authed(token).post("/api/clients").send({ name: "Draft Co" });

    await Promise.all([
      authed(token).put(`/api/clients/${created.body.id}`).send({ name: "Renamed Co" }),
      authed(token).put(`/api/clients/${created.body.id}`).send({ archived: true }),
    ]);

    const list = await authed(token).get("/api/clients");
    const client = list.body.find((c: any) => c.id === created.body.id);
    expect(client).toMatchObject({ name: "Renamed Co", archived: true });
  });

  it("404s updating a client that does not belong to the user", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    const created = await authed(tokenA).post("/api/clients").send({ name: "Private" });

    const res = await authed(tokenB).put(`/api/clients/${created.body.id}`).send({ name: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("deletes a client", async () => {
    const { token } = await registerUser();
    const created = await authed(token).post("/api/clients").send({ name: "Temp" });

    const del = await authed(token).delete(`/api/clients/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await authed(token).get("/api/clients");
    expect(list.body).toEqual([]);
  });

  it("404s deleting a client that does not belong to the user", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    const created = await authed(tokenA).post("/api/clients").send({ name: "Private" });

    const res = await authed(tokenB).delete(`/api/clients/${created.body.id}`);
    expect(res.status).toBe(404);
  });

  it("setting a project's client to a deleted client clears it (onDelete: SetNull)", async () => {
    const { token } = await registerUser();
    const client = await authed(token).post("/api/clients").send({ name: "Vanishing Co" });
    const project = await authed(token)
      .post("/api/projects")
      .send({ name: "Linked project", clientId: client.body.id });

    await authed(token).delete(`/api/clients/${client.body.id}`);

    const projects = await authed(token).get("/api/projects");
    const updated = projects.body.find((p: any) => p.id === project.body.id);
    expect(updated.clientId).toBeNull();
    expect(updated.client).toBeNull();
  });
});
