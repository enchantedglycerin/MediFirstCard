import { createClient } from "./client.js";
import { env } from "../config/env.js";

// Runs on Render (build step, DATABASE_URL set -> node-postgres) and locally / in
// CI (no DATABASE_URL -> PGlite on disk). Idempotent.
async function main() {
  const client = await createClient(
    env.DATABASE_URL ? { url: env.DATABASE_URL } : { dataDir: "./.data/pg" },
  );
  await client.runMigrations();
  await client.close();
  // eslint-disable-next-line no-console
  console.log(`migrations applied (${env.DATABASE_URL ? "node-postgres" : "pglite"})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("migration failed:", err);
  process.exit(1);
});
