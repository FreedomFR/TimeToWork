const BASE_URL = process.env.BASE_URL || "http://frontend";
const API_URL = process.env.API_URL || "http://backend:4000";

async function waitFor(url: string, label: string, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

export default async function globalSetup() {
  await waitFor(`${API_URL}/api/health`, "backend");
  await waitFor(BASE_URL, "frontend");
}
