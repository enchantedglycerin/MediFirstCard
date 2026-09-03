import type { DB } from "./db/client.js";

// Dependency-injected context so routes are testable with an in-memory DB.
export interface AppContext {
  db: DB;
}
