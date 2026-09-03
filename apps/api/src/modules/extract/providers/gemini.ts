// Gemini structured extraction: one image (+ optional OCR transcript) in, one
// validated Extraction out. REST generateContent with responseMimeType +
// responseJsonSchema (field names verified against ai.google.dev/api/generate-content
// on 2026-09-04; the SDK type docs describe responseJsonSchema as the JSON-Schema
// alternative to responseSchema). All network I/O goes through `fetchImpl`.
import { extractionSchema, EXTRACTION_JSON_SCHEMA, type Extraction } from "@mfc/shared";
import {
  ProviderError,
  withRetry,
  isRetryableStatus,
  clampConfidence,
  extractJsonObject,
  type FetchLike,
} from "./common.js";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export const GEMINI_EXTRACTION_PROMPT = `You extract structured fields from a photo of a Thai and/or English medical document: sick-leave medical certificates (ใบรับรองแพทย์), 5-disease medical certificates, prescriptions, medication labels, lab results and receipts.
Rules:
1. Return ONLY a JSON object matching the provided schema. Fill every field of the schema; when a field is absent or unreadable set value to null, confidence to 0 and evidence to null. Never invent, guess or translate values.
2. confidence is 0.0-1.0: how certain you are that the text was read correctly. Use 1.0 only when the text is printed, sharp and unambiguous; lower it for smudged, handwritten, partially hidden or ambiguous text.
3. evidence is the verbatim source text you read, in its original language, max 120 characters.
4. Dates are ISO YYYY-MM-DD. Thai Buddhist-era years (พ.ศ., or any year above 2400) are converted to CE by subtracting 543; keep the original text in evidence.
5. Keep Thai text in Thai. Doctor licence numbers look like "ว.12345". Output ICD-10 codes only when they are printed on the document.
6. medications: one entry per drug with name, strength, dose, frequency and duration exactly as printed.
7. If the image is not a medical document set document_type to "not_medical" and leave the other fields null. If the text is largely unreadable set image_quality to "poor" and explain in warnings.
8. An OCR transcript of the same document may follow the image. It may contain errors: prefer what you can see in the image.`;

export const OCR_TRANSCRIPT_PREFIX =
  "OCR transcript of the same document (may contain errors; prefer what you see in the image):\n";

export interface GeminiExtractInput {
  imageBase64: string;
  mime: string;
  ocrMarkdown?: string | null;
}

export interface GeminiExtractOptions {
  apiKey: string;
  model: string;
  fetchImpl?: FetchLike;
  retryBaseMs?: number;
}

interface GeminiTextPart { text: string }
interface GeminiInlinePart { inline_data: { mime_type: string; data: string } }
type GeminiPart = GeminiTextPart | GeminiInlinePart;

export interface GeminiRequestBody {
  contents: { role: "user"; parts: GeminiPart[] }[];
  generationConfig: {
    temperature: number;
    responseMimeType: "application/json";
    responseJsonSchema: typeof EXTRACTION_JSON_SCHEMA;
  };
}

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
  finishReason?: string;
}

interface GeminiResponseBody {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
}

/** finishReason values that mean the model refused rather than answered. */
const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY",
]);

export function buildGeminiRequestBody(input: GeminiExtractInput): GeminiRequestBody {
  const parts: GeminiPart[] = [
    { text: GEMINI_EXTRACTION_PROMPT },
    { inline_data: { mime_type: input.mime, data: input.imageBase64 } },
  ];
  if (input.ocrMarkdown) parts.push({ text: OCR_TRANSCRIPT_PREFIX + input.ocrMarkdown });
  return {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: EXTRACTION_JSON_SCHEMA,
    },
  };
}

export async function geminiExtract(
  input: GeminiExtractInput,
  opts: GeminiExtractOptions,
): Promise<{ extraction: Extraction; model: string }> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(opts.model)}:generateContent`;
  const body = JSON.stringify(buildGeminiRequestBody(input));

  const rawText = await withRetry(
    () => postGenerateContent(fetchImpl, url, opts.apiKey, body),
    { retries: 3, baseMs: opts.retryBaseMs ?? 1000 },
  );

  const extraction = parseGeminiResponse(rawText);
  return { extraction, model: opts.model };
}

/** One HTTP attempt: HTTP errors become ProviderErrors (retryable per status); network errors are retryable. */
async function postGenerateContent(fetchImpl: FetchLike, url: string, apiKey: string, body: string): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body,
    });
  } catch (e) {
    throw new ProviderError("gemini", `network error: ${errorMessage(e)}`, undefined, true);
  }
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new ProviderError("gemini", `HTTP ${res.status}: ${detail}`, res.status, isRetryableStatus(res.status));
  }
  try {
    return await res.text();
  } catch (e) {
    throw new ProviderError("gemini", `failed to read response body: ${errorMessage(e)}`, res.status, true);
  }
}

/** Turn the raw generateContent JSON into a validated Extraction (every failure here is non-retryable). */
export function parseGeminiResponse(rawText: string): Extraction {
  let parsed: GeminiResponseBody;
  try {
    parsed = JSON.parse(rawText) as GeminiResponseBody;
  } catch {
    throw new ProviderError("gemini", "response is not JSON", undefined, false);
  }

  const blockReason = parsed.promptFeedback?.blockReason;
  if (blockReason) throw new ProviderError("gemini", `prompt blocked (${blockReason})`, undefined, false);

  const candidate = Array.isArray(parsed.candidates) ? parsed.candidates[0] : undefined;
  if (!candidate) throw new ProviderError("gemini", "no candidates in response", undefined, false);

  const finishReason = candidate.finishReason;
  if (finishReason && BLOCKED_FINISH_REASONS.has(finishReason)) {
    throw new ProviderError("gemini", `response blocked (finishReason=${finishReason})`, undefined, false);
  }

  const text = (candidate.content?.parts ?? [])
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");
  if (!text.trim()) {
    throw new ProviderError("gemini", `empty response text (finishReason=${finishReason ?? "unknown"})`, undefined, false);
  }

  let json: unknown;
  try {
    json = JSON.parse(extractJsonObject(text));
  } catch {
    throw new ProviderError("gemini", `model output is not a JSON object (finishReason=${finishReason ?? "unknown"})`, undefined, false);
  }

  const result = extractionSchema.safeParse(clampConfidences(json));
  if (!result.success) {
    // Paths + messages only: never echo document contents into logs.
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ProviderError("gemini", `model output failed schema validation: ${issues}`, undefined, false);
  }
  return result.data;
}

/** Clamp every `confidence` property (top-level fields, icd10_codes, medications) into 0..1. */
function clampConfidences(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clampConfidences);
  if (node !== null && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      out[key] = key === "confidence" ? clampConfidence(value) : clampConfidences(value);
    }
    return out;
  }
  return node;
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const parsed = JSON.parse(await res.text()) as { error?: { message?: unknown; status?: unknown } };
    const status = parsed.error?.status;
    const message = parsed.error?.message;
    const parts = [
      typeof status === "string" ? status : null,
      typeof message === "string" ? message.slice(0, 200) : null,
    ].filter((s): s is string => s !== null);
    return parts.length ? parts.join(" ") : res.statusText || "request failed";
  } catch {
    return res.statusText || "request failed";
  }
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
