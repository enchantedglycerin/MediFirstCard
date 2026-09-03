import type { Extraction } from "@mfc/shared";
import { env } from "../../../config/env.js";
import { ProviderError, type FetchLike } from "./common.js";
import { geminiExtract } from "./gemini.js";
import { mockExtract } from "./mock.js";
import { typhoonOcr } from "./typhoon.js";

// Orchestrates one extraction: optional Typhoon OCR pass -> Gemini structured
// extraction -> mock fallback. The demo must never die on a provider outage, but
// mock output is always labelled source="mock" (the app shows an "example result"
// chip) so it is never presented as live.

export type ExtractionSource = "live" | "mock";

export interface ExtractionSettings {
  extractProvider: "gemini" | "mock";
  geminiApiKey?: string | undefined;
  geminiModel: string;
  ocrProvider: "typhoon" | "none";
  typhoonApiKey?: string | undefined;
}

export interface ExtractionResult {
  extraction: Extraction;
  model: string;
  source: ExtractionSource;
  warnings: string[];
}

export interface RunExtractionOptions {
  fetchImpl?: FetchLike;
  retryBaseMs?: number;
  /** Overrides the env-derived provider settings (tests). */
  settings?: ExtractionSettings;
}

export function settingsFromEnv(): ExtractionSettings {
  return {
    extractProvider: env.EXTRACT_PROVIDER,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
    ocrProvider: env.OCR_PROVIDER,
    typhoonApiKey: env.TYPHOON_API_KEY,
  };
}

/** Pure: which extraction provider the settings actually enable. */
export function chooseProvider(s: ExtractionSettings): "gemini" | "mock" {
  return s.extractProvider === "gemini" && s.geminiApiKey ? "gemini" : "mock";
}

let testFetch: FetchLike | null = null;

/** Route tests inject a fake fetch here; runExtraction uses it when no fetchImpl is passed. */
export function setExtractionFetchForTest(fetchImpl: FetchLike | null): void {
  testFetch = fetchImpl;
}

// One-line, secret-free, content-free diagnostic.
function warnProvider(step: string, err: unknown): void {
  const reason =
    err instanceof ProviderError
      ? err.message
      : err instanceof Error
        ? err.name
        : "unknown error";
  console.warn(`[extract] ${step}: ${reason}`);
}

export async function runExtraction(image: Buffer, mime: string, opts: RunExtractionOptions = {}): Promise<ExtractionResult> {
  const settings = opts.settings ?? settingsFromEnv();
  const apiKey = chooseProvider(settings) === "gemini" ? settings.geminiApiKey : undefined;
  if (!apiKey) {
    return { ...mockExtract(), source: "mock", warnings: ["ai_provider_not_configured"] };
  }

  const fetchImpl = opts.fetchImpl ?? testFetch ?? globalThis.fetch;
  const retryBaseMs = opts.retryBaseMs;
  const imageBase64 = image.toString("base64");
  const warnings: string[] = [];

  let ocrMarkdown: string | null = null;
  if (settings.ocrProvider === "typhoon" && settings.typhoonApiKey) {
    try {
      const ocr = await typhoonOcr({ imageBase64, mime }, { apiKey: settings.typhoonApiKey, fetchImpl, retryBaseMs });
      ocrMarkdown = ocr.markdown;
    } catch (e) {
      warnProvider("typhoon OCR unavailable, continuing without OCR text", e);
      warnings.push("ocr_unavailable");
    }
  }

  try {
    const result = await geminiExtract(
      { imageBase64, mime, ocrMarkdown },
      { apiKey, model: settings.geminiModel, fetchImpl, retryBaseMs },
    );
    const model = ocrMarkdown ? `${result.model}+typhoon-ocr` : result.model;
    return { extraction: result.extraction, model, source: "live", warnings };
  } catch (e) {
    warnProvider("gemini extraction failed, serving mock example", e);
    return { ...mockExtract(), source: "mock", warnings: ["ai_provider_unavailable"] };
  }
}
