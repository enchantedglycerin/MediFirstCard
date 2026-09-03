import {
  ProviderError,
  isRetryableStatus,
  withRetry,
  type FetchLike,
} from "../modules/extract/providers/common.js";
import type { StorageAdapter } from "./index.js";

export interface SupabaseStorageConfig {
  /** Project URL, e.g. https://<ref>.supabase.co */
  url: string;
  /** service_role key: bypasses RLS, so it must only ever live on the API server. */
  serviceRoleKey: string;
  bucket: string;
  fetchImpl?: FetchLike;
  /** Backoff base for 429/5xx/network retries (tests pass 0). */
  retryBaseMs?: number;
  /** Per-request timeout. */
  timeoutMs?: number;
}

// Supabase Storage over its REST API with native fetch (no @supabase/supabase-js).
// Endpoints verified 2026-09-04 against the storage server routes
// (github.com/supabase/storage src/http/routes/object/*) and the storage-js client:
//   POST   {url}/storage/v1/object/{bucket}/{path}                raw bytes, x-upsert: true
//   GET    {url}/storage/v1/object/authenticated/{bucket}/{path}  private-bucket read
//   HEAD   {url}/storage/v1/object/authenticated/{bucket}/{path}  200 exists / 404 missing
//   DELETE {url}/storage/v1/object/{bucket}   JSON { prefixes: [path] }
// The service-role key is sent as both `Authorization: Bearer` and `apikey`.
// The `/authenticated/` read route is used (rather than the plain `/object/` one the
// JS client uses) because it always requires the auth header and never falls through
// to public-bucket semantics, so a misconfigured key fails loudly instead of silently.
export class SupabaseStorage implements StorageAdapter {
  private readonly base: string;
  private readonly key: string;
  private readonly bucket: string;
  private readonly fetchImpl: FetchLike;
  private readonly retry: { baseMs: number };
  private readonly timeoutMs: number;

  constructor(cfg: SupabaseStorageConfig) {
    if (!cfg.url || !cfg.serviceRoleKey || !cfg.bucket) {
      throw new Error("SupabaseStorage requires url, serviceRoleKey and bucket");
    }
    this.base = `${cfg.url.replace(/\/+$/, "")}/storage/v1`;
    this.key = cfg.serviceRoleKey;
    this.bucket = cfg.bucket;
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch;
    this.retry = { baseMs: cfg.retryBaseMs ?? 1000 };
    this.timeoutMs = cfg.timeoutMs ?? 30_000;
  }

  async put(path: string, data: Buffer, contentType: string): Promise<void> {
    const url = this.objectUrl(path);
    await withRetry(async () => {
      const res = await this.request("put", "POST", url, {
        headers: { "Content-Type": contentType || "application/octet-stream", "x-upsert": "true" },
        body: data,
      });
      if (!res.ok) throw await this.errorFor("put", res);
      await discard(res);
    }, this.retry);
  }

  async get(path: string): Promise<Buffer> {
    const url = this.objectUrl(path, "authenticated");
    return withRetry(async () => {
      const res = await this.request("get", "GET", url);
      if (!res.ok) throw await this.errorFor("get", res);
      return Buffer.from(await res.arrayBuffer());
    }, this.retry);
  }

  async exists(path: string): Promise<boolean> {
    const url = this.objectUrl(path, "authenticated");
    return withRetry(async () => {
      const res = await this.request("exists", "HEAD", url);
      if (res.status === 200 || res.status === 404) {
        await discard(res);
        return res.status === 200;
      }
      throw await this.errorFor("exists", res);
    }, this.retry);
  }

  async remove(path: string): Promise<void> {
    const url = `${this.base}/object/${encodeURIComponent(this.bucket)}`;
    const body = JSON.stringify({ prefixes: [this.cleanPath(path)] });
    await withRetry(async () => {
      const res = await this.request("remove", "DELETE", url, {
        headers: { "Content-Type": "application/json" },
        body,
      });
      // 404 = already gone; mirrors the idempotent semantics of LocalStorage.remove.
      if (!res.ok && res.status !== 404) throw await this.errorFor("remove", res);
      await discard(res);
    }, this.retry);
  }

  /** Strip leading slashes and reject traversal / empty segments (same guard as LocalStorage). */
  private cleanPath(path: string): string {
    const segments = path.replace(/^\/+/, "").split("/");
    if (segments.some((s) => s === "" || s === "." || s === "..")) {
      throw new Error("invalid storage path");
    }
    return segments.join("/");
  }

  private objectUrl(path: string, prefix?: "authenticated"): string {
    const encoded = this.cleanPath(path).split("/").map(encodeURIComponent).join("/");
    const scope = prefix ? `${prefix}/` : "";
    return `${this.base}/object/${scope}${encodeURIComponent(this.bucket)}/${encoded}`;
  }

  private async request(
    op: string,
    method: "GET" | "HEAD" | "POST" | "DELETE",
    url: string,
    init: { headers?: Record<string, string>; body?: Buffer | string } = {},
  ): Promise<Response> {
    try {
      return await this.fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, apikey: this.key, ...init.headers },
        body: init.body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      // DNS/socket/timeout failures surface here; the message never carries the key.
      const reason = e instanceof Error ? e.message : "network error";
      throw new ProviderError("supabase", `${op} failed: ${reason}`, undefined, true);
    }
  }

  /** Build a ProviderError from a non-success response (body read for the server message only). */
  private async errorFor(op: string, res: Response): Promise<ProviderError> {
    let detail = res.statusText;
    try {
      const text = (await res.text()).trim();
      if (text) detail = pickMessage(text) ?? text;
    } catch {
      /* keep statusText */
    }
    const suffix = detail ? ` ${detail.slice(0, 200)}` : "";
    return new ProviderError(
      "supabase",
      `${op} failed: HTTP ${res.status}${suffix}`,
      res.status,
      isRetryableStatus(res.status),
    );
  }
}

/** Supabase error bodies look like { statusCode, error, message }; prefer the human message. */
function pickMessage(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const rec = parsed as Record<string, unknown>;
  if (typeof rec.message === "string") return rec.message;
  if (typeof rec.error === "string") return rec.error;
  return null;
}

/** Release the connection for responses whose body we do not need. */
async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* already consumed or no body */
  }
}
