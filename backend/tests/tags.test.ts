import { describe, expect, it } from "vitest";
import { authed, registerUser, request, app } from "./helpers";

describe("tags", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/tags");
    expect(res.status).toBe(401);
  });

  it("creates and lists tags alphabetically", async () => {
    const { token } = await registerUser();
    await authed(token).post("/api/tags").send({ name: "urgent" });
    await authed(token).post("/api/tags").send({ name: "billing" });

    const res = await authed(token).get("/api/tags");
    expect(res.status).toBe(200);
    expect(res.body.map((t: any) => t.name)).toEqual(["billing", "urgent"]);
  });

  it("rejects a tag without a name", async () => {
    const { token } = await registerUser();
    const res = await authed(token).post("/api/tags").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("does not show another user's tags", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    await authed(tokenA).post("/api/tags").send({ name: "only-mine" });

    const res = await authed(tokenB).get("/api/tags");
    expect(res.body).toEqual([]);
  });

  it("deletes a tag", async () => {
    const { token } = await registerUser();
    const created = await authed(token).post("/api/tags").send({ name: "temp" });

    const del = await authed(token).delete(`/api/tags/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await authed(token).get("/api/tags");
    expect(list.body).toEqual([]);
  });

  it("404s deleting a tag that does not belong to the user", async () => {
    const { token: tokenA } = await registerUser();
    const { token: tokenB } = await registerUser();
    const created = await authed(tokenA).post("/api/tags").send({ name: "private" });

    const res = await authed(tokenB).delete(`/api/tags/${created.body.id}`);
    expect(res.status).toBe(404);
  });
});
