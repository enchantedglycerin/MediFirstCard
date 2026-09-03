import { mkdir, readFile, writeFile, unlink, access } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import type { StorageAdapter } from "./index.js";

// Local-disk object store under apps/api/.data/records. Paths are user-scoped
// (e.g. "<userId>/<recordId>.jpg") and cannot escape the root.
export class LocalStorage implements StorageAdapter {
  private root = resolve(process.cwd(), ".data", "records");

  private safe(path: string): string {
    const full = normalize(join(this.root, path));
    if (!full.startsWith(this.root + sep) && full !== this.root) {
      throw new Error("invalid storage path");
    }
    return full;
  }

  async put(path: string, data: Buffer, _contentType: string): Promise<void> {
    const full = this.safe(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(path: string): Promise<Buffer> {
    return readFile(this.safe(path));
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(this.safe(path));
      return true;
    } catch {
      return false;
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await unlink(this.safe(path));
    } catch {
      /* already gone */
    }
  }
}
