import request from "supertest";
import { app } from "../src/app";

let counter = 0;

export function uniqueEmail() {
  counter += 1;
  return `user${Date.now()}_${counter}@example.com`;
}

export async function registerUser(overrides: Partial<{ email: string; password: string; name: string }> = {}) {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? "password123";
  const name = overrides.name ?? "Test User";

  const res = await request(app).post("/api/auth/register").send({ email, password, name });
  if (res.status !== 201) {
    throw new Error(`Failed to register test user: ${JSON.stringify(res.body)}`);
  }

  return { token: res.body.token as string, user: res.body.user as { id: string; email: string; name: string } };
}

export function authed(token: string) {
  return {
    get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set("Authorization", `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set("Authorization", `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${token}`),
  };
}

export { request, app };
