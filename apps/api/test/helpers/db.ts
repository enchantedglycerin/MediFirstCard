import { createClient, type DbClient } from "../../src/db/client.js";

/** Fresh in-memory PGlite database with migrations applied, for one test file. */
export async function makeTestDb(): Promise<DbClient> {
  const client = await createClient({ memory: true });
  await client.runMigrations();
  return client;
}
