import type { StorageAdapter } from "../../src/storage/index.js";

/** In-memory storage adapter for tests (no disk writes). */
export class MemStorage implements StorageAdapter {
  private files = new Map<string, Buffer>();
  async put(path: string, data: Buffer): Promise<void> { this.files.set(path, data); }
  async get(path: string): Promise<Buffer> {
    const b = this.files.get(path);
    if (!b) throw new Error("not found");
    return b;
  }
  async exists(path: string): Promise<boolean> { return this.files.has(path); }
  async remove(path: string): Promise<void> { this.files.delete(path); }
}
