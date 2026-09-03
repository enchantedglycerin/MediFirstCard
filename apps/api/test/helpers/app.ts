import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { setStorageForTest } from "../../src/storage/index.js";
import { makeTestDb } from "./db.js";
import { MemStorage } from "./memStorage.js";

export interface TestApp {
  agent: supertest.Agent;
  db: Awaited<ReturnType<typeof makeTestDb>>["db"];
  close: () => Promise<void>;
}

export async function makeTestApp(): Promise<TestApp> {
  const dbc = await makeTestDb();
  setStorageForTest(new MemStorage());
  const app = createApp({ db: dbc.db });
  return { agent: supertest(app), db: dbc.db, close: () => dbc.close() };
}

/** Register a fresh user and return an authorized helper. */
export async function registerUser(t: TestApp, email = `u${Date.now()}${Math.random().toString(36).slice(2)}@t.com`) {
  const res = await t.agent.post("/api/v1/auth/register").send({ email, password: "password123" });
  return { email, ...res.body as { user: { id: string }; accessToken: string; refreshToken: string } };
}
