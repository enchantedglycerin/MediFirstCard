// Shared helpers for the external AI/storage providers (Gemini, Typhoon, Supabase).
// Providers take an injectable `fetchImpl` so tests run offline with a fake fetch.

export type FetchLike = typeof fetch;

export type ProviderName = "gemini" | "typhoon" | "supabase";

export class ProviderError extends Error {
  constructor(
    public provider: ProviderName,
    message: string,
    public status?: number,
    /** true for 429 / 5xx / network errors: worth retrying with backoff. */
    public retryable = false,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

export const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

/** Exponential backoff (base, 2x, 4x …) for retryable ProviderErrors only. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; onRetry?: (attempt: number, err: unknown) => void } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 1000;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e instanceof ProviderError ? e.retryable : false;
      if (!retryable || attempt >= retries) throw e;
      opts.onRetry?.(attempt + 1, e);
      await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt));
      attempt++;
    }
  }
}

/** Clamp a model-reported confidence into 0..1 (models occasionally emit 0-100 or >1). */
export function clampConfidence(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  const scaled = n > 1 && n <= 100 ? n / 100 : n;
  return Math.min(1, Math.max(0, scaled));
}

/** Pull the first {...} JSON object out of a model reply that may carry prose or ``` fences. */
export function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in model output");
  return text.slice(start, end + 1);
}
