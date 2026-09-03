import { describe, it, expect, afterAll } from "vitest";
import { makeTestDb } from "./helpers/db.js";
import { users, emergencyProfiles, medicalRecords } from "../src/db/schema.js";
import { DEFAULT_LOCK_SCREEN_FIELDS } from "@mfc/shared";

const c = await makeTestDb();
afterAll(() => c.close());

describe("database layer (PGlite)", () => {
  it("migrates all tables and round-trips a user", async () => {
    const [u] = await c.db.insert(users).values({ email: "a@b.com", passwordHash: "x" }).returning();
    expect(u?.email).toBe("a@b.com");
    expect(u?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("stores jsonb lock-screen fields on the profile", async () => {
    const [u] = await c.db.insert(users).values({ email: "p@b.com", passwordHash: "x" }).returning();
    const [p] = await c.db
      .insert(emergencyProfiles)
      .values({ userId: u!.id, lockScreenFields: DEFAULT_LOCK_SCREEN_FIELDS })
      .returning();
    expect((p?.lockScreenFields as { bloodType: boolean }).bloodType).toBe(true);
  });

  it("enforces the per-user sha256 unique index on records", async () => {
    const [u] = await c.db.insert(users).values({ email: "r@b.com", passwordHash: "x" }).returning();
    const sha = "a".repeat(64);
    await c.db.insert(medicalRecords).values({ userId: u!.id, sha256: sha });
    await expect(
      c.db.insert(medicalRecords).values({ userId: u!.id, sha256: sha }),
    ).rejects.toThrow();
  });
});
