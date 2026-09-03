import { env } from "../config/env.js";
import { LocalStorage } from "./local.js";

export interface StorageAdapter {
  put(path: string, data: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

let instance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (instance) return instance;
  if (env.STORAGE_PROVIDER === "supabase") {
    // Supabase Storage adapter (signed upload/download URLs) is wired at cloud-deploy
    // time. Local disk covers dev, CI and the demo fallback until then.
    throw new Error("STORAGE_PROVIDER=supabase not wired yet — use STORAGE_PROVIDER=local");
  }
  instance = new LocalStorage();
  return instance;
}

export function setStorageForTest(adapter: StorageAdapter): void {
  instance = adapter;
}
