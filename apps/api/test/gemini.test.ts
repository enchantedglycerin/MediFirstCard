import { describe, it, expect } from "vitest";
import { extractionSchema } from "@mfc/shared";
import {
  geminiExtract,
  GEMINI_EXTRACTION_PROMPT,
  OCR_TRANSCRIPT_PREFIX,
} from "../src/modules/extract/providers/gemini.js";
import { ProviderError, type FetchLike } from "../src/modules/extract/providers/common.js";
import { mockExtract } from "../src/modules/extract/providers/mock.js";

// ---- offline fake fetch -----------------------------------------------------

interface Call { url: string; init: RequestInit }

function fakeFetch(responses: Array<Response | Error>): { fetchImpl: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = queue.shift();
    if (!next) throw new Error("fake fetch: no canned response left");
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetchImpl, calls };
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A Gemini generateContent reply whose single text part is `text`. */
const geminiReply = (text: string, finishReason = "STOP") =>
  jsonResponse(200, { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }] });

const cannedExtraction = () => mockExtract().extraction; // has one low-confidence field (doctor_license_no)
const OPTS = { apiKey: "test-key", model: "gemini-2.5-flash-lite", retryBaseMs: 0 };
const INPUT = { imageBase64: Buffer.from("fake-jpeg").toString("base64"), mime: "image/jpeg" };

const bodyOf = (call: Call) => JSON.parse(call.init.body as string) as {
  contents: { role: string; parts: Record<string, unknown>[] }[];
  generationConfig: Record<string, unknown>;
};

// ---- tests ------------------------------------------------------------------

describe("geminiExtract", () => {
  it("sends the documented request shape and returns a validated extraction", async () => {
    const { fetchImpl, calls } = fakeFetch([geminiReply(JSON.stringify(cannedExtraction()))]);

    const result = await geminiExtract(INPUT, { ...OPTS, fetchImpl });

    expect(calls.length).toBe(1);
    const call = calls[0]!;
    expect(call.url).toContain("/models/gemini-2.5-flash-lite:generateContent");
    expect(call.url.startsWith("https://generativelanguage.googleapis.com/v1beta/")).toBe(true);
    expect(call.url).not.toContain("test-key"); // key goes in the header, never the URL
    expect(call.init.method).toBe("POST");
    expect(new Headers(call.init.headers).get("x-goog-api-key")).toBe("test-key");
    expect(new Headers(call.init.headers).get("content-type")).toBe("application/json");

    const body = bodyOf(call);
    expect(body.contents.length).toBe(1);
    expect(body.contents[0]!.role).toBe("user");
    const parts = body.contents[0]!.parts;
    expect(parts.length).toBe(2); // prompt + image, no OCR part
    expect(parts[0]!.text).toBe(GEMINI_EXTRACTION_PROMPT);
    expect(parts[1]!.inline_data).toEqual({ mime_type: "image/jpeg", data: INPUT.imageBase64 });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema).toMatchObject({ type: "object" });
    expect(body.generationConfig.temperature).toBe(0.1);

    expect(result.model).toBe("gemini-2.5-flash-lite");
    expect(extractionSchema.safeParse(result.extraction).success).toBe(true);
    expect(result.extraction.document_type).toBe("medical_certificate_sick_leave");
    expect(result.extraction.doctor_license_no.confidence).toBe(0.44); // low-confidence field survives untouched
  });

  it("adds the OCR transcript as a text part after the image when provided", async () => {
    const { fetchImpl, calls } = fakeFetch([geminiReply(JSON.stringify(cannedExtraction()))]);
    const markdown = "# ใบรับรองแพทย์\n\nชื่อ สมชาย ใจดี";

    await geminiExtract({ ...INPUT, ocrMarkdown: markdown }, { ...OPTS, fetchImpl });

    const parts = bodyOf(calls[0]!).contents[0]!.parts;
    expect(parts.length).toBe(3);
    expect(parts[2]!.text).toBe(OCR_TRANSCRIPT_PREFIX + markdown);
  });

  it("retries a 429 and succeeds on the next attempt", async () => {
    const { fetchImpl, calls } = fakeFetch([
      jsonResponse(429, { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "quota" } }),
      geminiReply(JSON.stringify(cannedExtraction())),
    ]);

    const result = await geminiExtract(INPUT, { ...OPTS, fetchImpl });

    expect(calls.length).toBe(2);
    expect(result.extraction.patient_name.value).toBe("สมชาย ใจดี");
  });

  it("retries a network failure", async () => {
    const { fetchImpl, calls } = fakeFetch([
      new TypeError("fetch failed"),
      geminiReply(JSON.stringify(cannedExtraction())),
    ]);

    await expect(geminiExtract(INPUT, { ...OPTS, fetchImpl })).resolves.toBeTruthy();
    expect(calls.length).toBe(2);
  });

  it("throws a non-retryable ProviderError on 400 without retrying", async () => {
    const { fetchImpl, calls } = fakeFetch([
      jsonResponse(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "API key not valid" } }),
      geminiReply(JSON.stringify(cannedExtraction())), // must never be consumed
    ]);

    const err = await geminiExtract(INPUT, { ...OPTS, fetchImpl }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ProviderError);
    const pe = err as ProviderError;
    expect(pe.provider).toBe("gemini");
    expect(pe.status).toBe(400);
    expect(pe.retryable).toBe(false);
    expect(pe.message).toContain("INVALID_ARGUMENT");
    expect(calls.length).toBe(1);
  });

  it("gives up after the retry budget on persistent 503s", async () => {
    const { fetchImpl, calls } = fakeFetch([
      jsonResponse(503, {}), jsonResponse(503, {}), jsonResponse(503, {}), jsonResponse(503, {}),
    ]);

    const err = await geminiExtract(INPUT, { ...OPTS, fetchImpl }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).status).toBe(503);
    expect((err as ProviderError).retryable).toBe(true);
    expect(calls.length).toBe(4); // 1 + 3 retries
  });

  it("clamps 0-100 confidences to 0..1, including icd10_codes and medications", async () => {
    const raw = cannedExtraction();
    raw.patient_name.confidence = 92;
    raw.icd10_codes[0]!.confidence = 70;
    raw.medications[0]!.confidence = 150; // out of range -> clamped to 1
    raw.rest_days.confidence = -3;        // negative -> 0
    const { fetchImpl } = fakeFetch([geminiReply(JSON.stringify(raw))]);

    const { extraction } = await geminiExtract(INPUT, { ...OPTS, fetchImpl });

    expect(extraction.patient_name.confidence).toBe(0.92);
    expect(extraction.icd10_codes[0]!.confidence).toBe(0.7);
    expect(extraction.medications[0]!.confidence).toBe(1);
    expect(extraction.rest_days.confidence).toBe(0);
    expect(extraction.doctor_license_no.confidence).toBe(0.44); // already in range: untouched
  });

  it("parses JSON wrapped in prose and ```json fences", async () => {
    const wrapped = "Here is the extraction:\n```json\n" + JSON.stringify(cannedExtraction(), null, 2) + "\n```\nDone.";
    const { fetchImpl } = fakeFetch([geminiReply(wrapped)]);

    const { extraction } = await geminiExtract(INPUT, { ...OPTS, fetchImpl });

    expect(extraction.hospital.value).toBe("โรงพยาบาลตัวอย่าง");
  });

  it("joins multiple text parts before parsing", async () => {
    const text = JSON.stringify(cannedExtraction());
    const half = Math.floor(text.length / 2);
    const { fetchImpl } = fakeFetch([
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: text.slice(0, half) }, { text: text.slice(half) }] }, finishReason: "STOP" }],
      }),
    ]);

    const { extraction } = await geminiExtract(INPUT, { ...OPTS, fetchImpl });
    expect(extraction.visit_date.value).toBe("2026-09-03");
  });

  it("treats a blocked prompt (no candidates) as a non-retryable ProviderError", async () => {
    const { fetchImpl, calls } = fakeFetch([
      jsonResponse(200, { promptFeedback: { blockReason: "SAFETY" } }),
      geminiReply(JSON.stringify(cannedExtraction())),
    ]);

    const err = await geminiExtract(INPUT, { ...OPTS, fetchImpl }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).retryable).toBe(false);
    expect((err as ProviderError).message).toContain("SAFETY");
    expect(calls.length).toBe(1);
  });

  it("treats finishReason SAFETY as a non-retryable ProviderError", async () => {
    const { fetchImpl } = fakeFetch([
      jsonResponse(200, { candidates: [{ finishReason: "SAFETY", safetyRatings: [] }] }),
    ]);

    const err = await geminiExtract(INPUT, { ...OPTS, fetchImpl }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).retryable).toBe(false);
    expect((err as ProviderError).message).toContain("SAFETY");
  });

  it("throws a non-retryable ProviderError on unparsable or schema-invalid model output", async () => {
    const notJson = fakeFetch([geminiReply("I could not read the document."), geminiReply("{}")]);
    const err1 = await geminiExtract(INPUT, { ...OPTS, fetchImpl: notJson.fetchImpl }).catch((e: unknown) => e);
    expect(err1).toBeInstanceOf(ProviderError);
    expect((err1 as ProviderError).retryable).toBe(false);
    expect(notJson.calls.length).toBe(1); // no retry on bad output

    const invalid = fakeFetch([geminiReply(JSON.stringify({ document_type: "receipt", language: "th" }))]);
    const err2 = await geminiExtract(INPUT, { ...OPTS, fetchImpl: invalid.fetchImpl }).catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(ProviderError);
    expect((err2 as ProviderError).retryable).toBe(false);
    expect((err2 as ProviderError).message).toContain("schema validation");
  });
});
