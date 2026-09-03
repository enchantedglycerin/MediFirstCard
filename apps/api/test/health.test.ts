import { describe, it, expect, afterAll } from "vitest";
import { makeTestApp, type TestApp } from "./helpers/app.js";

let t: TestApp;
async function app() { return (t ??= await makeTestApp()); }
afterAll(async () => { await t?.close(); });

describe("health", () => {
  it("GET /health returns ok with provider info", async () => {
    const res = await (await app()).agent.get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.extractProvider).toBe("mock");
    expect(res.body.storageProvider).toBe("local");
    expect(res.body.encryption).toBe("on");
  });

  it("unknown route returns 404", async () => {
    const res = await (await app()).agent.get("/does-not-exist");
    expect(res.status).toBe(404);
  });
});
