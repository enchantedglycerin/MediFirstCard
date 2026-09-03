import { env, type Env } from "../config/env.js";
import type { FetchLike } from "../modules/extract/providers/common.js";
import { LocalStorage } from "./local.js";
import { SupabaseStorage } from "./supabase.js";

export interface StorageAdapter {
  put(path: string, data: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

export type StorageEnv = Pick<Env, "STORAGE_PROVIDER" | "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "SUPABASE_BUCKET">;

/**
 * Build the adapter for an env-like object (pure: no process.env, so tests can pass
 * their own). STORAGE_PROVIDER=supabase needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY;
 * anything else is the local-disk store used for dev, CI and the demo fallback.
 */
export function createStorageFromEnv(
  e: StorageEnv,
  opts: { fetchImpl?: FetchLike; retryBaseMs?: number } = {},
): StorageAdapter {
  if (e.STORAGE_PROVIDER !== "supabase") return new LocalStorage();
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } = e;
  if (!url || !serviceRoleKey) {
    const missing = [!url && "SUPABASE_URL", !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
    throw new Error(
      `STORAGE_PROVIDER=supabase requires ${missing.join(" and ")} (set them in apps/api/.env, or use STORAGE_PROVIDER=local)`,
    );
  }
  return new SupabaseStorage({
    url,
    serviceRoleKey,
    bucket: e.SUPABASE_BUCKET,
    fetchImpl: opts.fetchImpl,
    retryBaseMs: opts.retryBaseMs,
  });
}

let instance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (instance) return instance;
  instance = createStorageFromEnv(env);
  return instance;
}

export function setStorageForTest(adapter: StorageAdapter): void {
  instance = adapter;
}
