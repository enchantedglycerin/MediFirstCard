import { ProviderError, isRetryableStatus, withRetry, type FetchLike } from "./common.js";

// Typhoon OCR 1.5 (SCB 10X) via the OpenAI-compatible chat/completions endpoint.
// Verified 2026-09-03 in the local research notes: no dedicated OCR
// route, the image goes in as an image_url data URI, output is Markdown text in
// choices[0].message.content, and the model only works with the exact prompt the
// official typhoon-ocr package sends. Free tier: 2 rps / 20 rpm -> 429, retried.

export const TYPHOON_BASE_URL = "https://api.opentyphoon.ai/v1";
export const TYPHOON_OCR_MODEL = "typhoon-ocr";

/** Exact v1.5 prompt from typhoon_ocr/ocr_utils.py PROMPTS_SYS["v1.5"], {figure_language} = Thai. */
export const TYPHOON_OCR_PROMPT = [
  "Extract all text from the image.",
  "",
  "",
  "Instructions:",
  "- Only return the clean Markdown.",
  "- Do not include any explanation or extra text.",
  "- You must include all information on the page.",
  "",
  "",
  "Formatting Rules:",
  "- Tables: Render tables using <table>...</table> in clean HTML format.",
  "- Equations: Render equations using LaTeX syntax with inline ($...$) and block ($$...$$).",
  "- Images/Charts/Diagrams: Wrap any clearly defined visual areas (e.g. charts, diagrams, pictures) in:",
  "",
  "",
  "<figure>",
  "Describe the image's main elements (people, objects, text), note any contextual clues (place, event, culture), mention visible text and its meaning, provide deeper analysis when relevant (especially for financial charts, graphs, or documents), comment on style or architecture if relevant, then give a concise overall summary. Describe in Thai.",
  "</figure>",
  "",
  "",
  "- Page Numbers: Wrap page numbers in <page_number>...</page_number> (e.g., <page_number>14</page_number>).",
  "- Checkboxes: Use ☐ for unchecked and ☑ for checked boxes.",
].join("\n");

export interface TyphoonOcrInput {
  imageBase64: string;
  mime: string;
}

export interface TyphoonOcrOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  retryBaseMs?: number;
}

export interface TyphoonOcrResult {
  markdown: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
}

export async function typhoonOcr(input: TyphoonOcrInput, opts: TyphoonOcrOptions): Promise<TyphoonOcrResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const payload = JSON.stringify({
    model: TYPHOON_OCR_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: TYPHOON_OCR_PROMPT },
          { type: "image_url", image_url: { url: `data:${input.mime};base64,${input.imageBase64}` } },
        ],
      },
    ],
    max_tokens: 16384,
    temperature: 0.1,
    top_p: 0.6,
    repetition_penalty: 1.1,
  });

  return withRetry(
    async () => {
      let res: Response;
      try {
        res = await fetchImpl(`${TYPHOON_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
          body: payload,
        });
      } catch {
        throw new ProviderError("typhoon", "network error", undefined, true);
      }
      if (!res.ok) {
        throw new ProviderError("typhoon", `HTTP ${res.status}`, res.status, isRetryableStatus(res.status));
      }
      let json: ChatCompletionResponse;
      try {
        json = (await res.json()) as ChatCompletionResponse;
      } catch {
        throw new ProviderError("typhoon", "invalid JSON response", res.status);
      }
      const content = json.choices?.[0]?.message?.content;
      const markdown = typeof content === "string" ? content.trim() : "";
      if (!markdown) throw new ProviderError("typhoon", "empty OCR output", res.status);
      return { markdown, model: TYPHOON_OCR_MODEL };
    },
    { retries: 3, baseMs: opts.retryBaseMs },
  );
}
