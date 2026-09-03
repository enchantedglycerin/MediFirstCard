import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import * as schema from "./schema.js";

// Works from the TypeScript source (src/db -> ../../drizzle) and from the esbuild bundle
// that Render/Docker start (dist/server.mjs -> ../drizzle), with the workspace cwd as a
// final fallback.
const MIGRATIONS_DIR = (() => {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "..", "..", "drizzle"), join(here, "..", "drizzle"), join(process.cwd(), "drizzle")];
  return candidates.find((d) => existsSync(join(d, "meta", "_journal.json"))) ?? candidates[0]!;
})();

// The query API is identical across drivers at runtime; type against the PGlite
// shape (used by tests, CI and local dev) and cast the node-postgres one to it.
export type DB = PgliteDatabase<typeof schema>;

export interface DbClient {
  db: DB;
  runMigrations: () => Promise<void>;
  close: () => Promise<void>;
}

export interface CreateClientOpts {
  /** node-postgres connection string (Render/Supabase). If absent, PGlite is used. */
  url?: string;
  /** PGlite persistence directory (local dev). Ignored when `memory` is true. */
  dataDir?: string;
  /** In-memory PGlite (tests). */
  memory?: boolean;
}

/**
 * DATABASE_URL present -> real Postgres via node-postgres (Render/Supabase).
 * Otherwise -> PGlite (real Postgres in WASM): in-memory for tests, on disk for
 * local dev. No Docker required.
 */
export async function createClient(opts: CreateClientOpts): Promise<DbClient> {
  if (opts.url) {
    const pool = new pg.Pool({
      connectionString: opts.url,
      ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
    const db = drizzlePg(pool, { schema }) as unknown as DB;
    return {
      db,
      runMigrations: () => migratePg(db as never, { migrationsFolder: MIGRATIONS_DIR }),
      close: () => pool.end(),
    };
  }

  let pglite: PGlite;
  if (opts.memory) {
    pglite = new PGlite();
  } else {
    const dir = resolve(process.cwd(), opts.dataDir ?? "./.data/pg");
    mkdirSync(dir, { recursive: true }); // PGlite's nodefs does not create parent dirs
    pglite = new PGlite(dir);
  }
  const db = drizzlePglite(pglite, { schema });
  return {
    db,
    runMigrations: () => migratePglite(db, { migrationsFolder: MIGRATIONS_DIR }),
    close: () => pglite.close(),
  };
}
