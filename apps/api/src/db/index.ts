import { env } from "../config/env.js";
import { createClient, type DB, type DbClient } from "./client.js";

let client: DbClient | null = null;

/** Initialise the process-wide DB and apply migrations. Called from server.ts before listen. */
export async function initDb(): Promise<DB> {
  if (client) return client.db;
  client = await createClient(env.DATABASE_URL ? { url: env.DATABASE_URL } : { dataDir: "./.data/pg" });
  await client.runMigrations();
  return client.db;
}

export function getDb(): DB {
  if (!client) throw new Error("DB not initialised — call initDb() first");
  return client.db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
}

export { type DB } from "./client.js";
