import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { makeTestApp, registerUser, type TestApp } from "./helpers/app.js";
import type { FetchLike } from "../src/modules/extract/providers/common.js";
import { mockExtract } from "../src/modules/extract/providers/mock.js";
import {
  chooseProvider,
  runExtraction,
  setExtractionFetchForTest,
  type ExtractionSettings,
} from "../src/modules/extract/providers/index.js";

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---------- route: default test env keeps the mock provider ----------

describe("POST /records/:id/extract (default env = mock provider)", () => {
  let t: TestApp;
  beforeAll(async () => { t = await makeTestApp(); });
  afterAll(async () => { await t.close(); });

  async function createRecord(h: Record<string, string>, image: Buffer) {
    const sha = createHash("sha256").update(image).digest("hex");
    const create = await t.agent.post("/api/v1/records").set(h).send({
      kind: "sick_leave", sha256: sha, sizeBytes: image.length, mime: "image/jpeg",
    });
    expect(create.status).toBe(201);
    return create.body.recordId as string;
  }

  it("returns the mock example (source=mock, model, merged warnings) after the blob is uploaded", async () => {
    const u = await registerUser(t);
    const h = bearer(u.accessToken);
    const image = Buffer.from("fake-jpeg-bytes-for-extract-route-" + "y".repeat(500));
    const recordId = await createRecord(h, image);

    const blob = await t.agent.put(`/api/v1/records/${recordId}/blob`).set(h).set("Content-Type", "image/jpeg").send(image);
    expect(blob.status).toBe(200);

    const res = await t.agent.post(`/api/v1/records/${recordId}/extract`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock");
    expect(res.body.model).toBe("mock-1");
    expect(res.body.warnings).toEqual(["mock provider", "ai_provider_not_configured"]);
    expect(res.body.extractionId).toBeTruthy();
    expect(res.body.needsReview).toBe(true);
    expect(res.body.fieldMeta.doctor_license_no.band).toBe("low");
    expect(res.body.extraction.patient_name.value).toBe(mockExtract().extraction.patient_name.value);
  });

  it("rejects extraction before the image bytes exist (409 NO_BLOB)", async () => {
    const u = await registerUser(t);
    const h = bearer(u.accessToken);
    const recordId = await createRecord(h, Buffer.from("never-uploaded-" + "z".repeat(100)));
    const res = await t.agent.post(`/api/v1/records/${recordId}/extract`).set(h);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NO_BLOB");
  });

  it("404s for another user's record", async () => {
    const owner = await registerUser(t);
    const recordId = await createRecord(bearer(owner.accessToken), Buffer.from("owned-" + "w".repeat(100)));
    const other = await registerUser(t);
    const res = await t.agent.post(`/api/v1/records/${recordId}/extract`).set(bearer(other.accessToken));
    expect(res.status).toBe(404);
  });
});

// ---------- runExtraction branching with an injected fetch + settings override ----------

interface Call { url: string; init: RequestInit }

function fakeFetch(handler: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn: FetchLike = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const call = { url, init: init ?? {} };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  return Object.assign(fn, { calls });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const isTyphoon = (url: string) => url.includes("api.opentyphoon.ai");
const isGemini = (url: string) => url.includes("generativelanguage.googleapis.com");

const OCR_TEXT = "# ใบรับรองแพทย์\n\nผู้ป่วย: ทดสอบ ไลฟ์ OCR-MARKER-8842";
const typhoonOk = () => json({ choices: [{ message: { role: "assistant", content: OCR_TEXT } }] });

// A "live" model answer that is distinguishable from the mock example.
const liveExtraction = { ...mockExtract().extraction, patient_name: { value: "ทดสอบ ไลฟ์", confidence: 0.95, evidence: "ผู้ป่วย: ทดสอบ ไลฟ์" } };
const geminiOk = () =>
  json({
    candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(liveExtraction) }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 400, totalTokenCount: 1600 },
  });

const GEMINI_KEY = "gemini-secret-key-3f9a2";
const TYPHOON_KEY = "typhoon-secret-key-7c1d0";
const live: ExtractionSettings = {
  extractProvider: "gemini", geminiApiKey: GEMINI_KEY, geminiModel: "gemini-test-model",
  ocrProvider: "typhoon", typhoonApiKey: TYPHOON_KEY,
};
const image = Buffer.from("fake-image-bytes");

describe("runExtraction", () => {
  afterEach(() => {
    setExtractionFetchForTest(null);
    vi.restoreAllMocks();
  });

  it("chooseProvider only picks gemini when both the provider and its key are set", () => {
    expect(chooseProvider(live)).toBe("gemini");
    expect(chooseProvider({ ...live, geminiApiKey: undefined })).toBe("mock");
    expect(chooseProvider({ ...live, geminiApiKey: "" })).toBe("mock");
    expect(chooseProvider({ ...live, extractProvider: "mock" })).toBe("mock");
  });

  it("returns the mock example without any network call when the AI provider is not configured", async () => {
    const f = fakeFetch(() => { throw new Error("must not be called"); });
    const r = await runExtraction(image, "image/jpeg", { fetchImpl: f, retryBaseMs: 0, settings: { ...live, geminiApiKey: undefined } });
    expect(r.source).toBe("mock");
    expect(r.model).toBe("mock-1");
    expect(r.warnings).toEqual(["ai_provider_not_configured"]);
    expect(f.calls).toHaveLength(0);
  });

  it("live path with OCR: Typhoon first, then Gemini receives the OCR transcript", async () => {
    const f = fakeFetch((c) => (isTyphoon(c.url) ? typhoonOk() : geminiOk()));
    const r = await runExtraction(image, "image/png", { fetchImpl: f, retryBaseMs: 0, settings: live });

    expect(r.source).toBe("live");
    expect(r.model).toBe("gemini-test-model+typhoon-ocr");
    expect(r.warnings).toEqual([]);
    expect(r.extraction.patient_name.value).toBe("ทดสอบ ไลฟ์");

    expect(f.calls).toHaveLength(2);
    expect(isTyphoon(f.calls[0]!.url)).toBe(true);
    expect(isGemini(f.calls[1]!.url)).toBe(true);
    const typhoonBody = f.calls[0]!.init.body as string;
    expect(typhoonBody).toContain(`data:image/png;base64,${image.toString("base64")}`);
    const geminiBody = f.calls[1]!.init.body as string;
    expect(geminiBody).toContain("OCR-MARKER-8842");
    expect(geminiBody).toContain(image.toString("base64"));
  });

  it("OCR failure: warns ocr_unavailable, still extracts live via Gemini without the transcript", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = fakeFetch((c) => (isTyphoon(c.url) ? json({ error: "down" }, 500) : geminiOk()));
    const r = await runExtraction(image, "image/jpeg", { fetchImpl: f, retryBaseMs: 0, settings: live });

    expect(r.source).toBe("live");
    expect(r.model).toBe("gemini-test-model");
    expect(r.warnings).toEqual(["ocr_unavailable"]);
    expect(r.extraction.patient_name.value).toBe("ทดสอบ ไลฟ์");

    const typhoonCalls = f.calls.filter((c) => isTyphoon(c.url));
    const geminiCalls = f.calls.filter((c) => isGemini(c.url));
    expect(typhoonCalls).toHaveLength(4); // 1 + 3 retries on 5xx
    expect(geminiCalls).toHaveLength(1);
    expect(geminiCalls[0]!.init.body as string).not.toContain("OCR-MARKER-8842");

    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
    expect(logged).not.toContain(TYPHOON_KEY);
    expect(logged).not.toContain(GEMINI_KEY);
  });

  it("Gemini failure after retries: falls back to the mock example labelled ai_provider_unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = fakeFetch(() => json({ error: { message: "overloaded" } }, 503));
    const r = await runExtraction(image, "image/jpeg", { fetchImpl: f, retryBaseMs: 0, settings: { ...live, ocrProvider: "none" } });

    expect(r.source).toBe("mock");
    expect(r.model).toBe("mock-1");
    expect(r.warnings).toEqual(["ai_provider_unavailable"]);
    expect(r.extraction).toEqual(mockExtract().extraction);
    expect(f.calls.every((c) => isGemini(c.url))).toBe(true);
    expect(f.calls.length).toBeGreaterThanOrEqual(2); // at least one retry happened

    const logged = warn.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
    expect(logged).not.toContain(GEMINI_KEY);
    expect(logged).not.toContain(image.toString("base64"));
  });

  it("setExtractionFetchForTest supplies the fetch when none is passed explicitly", async () => {
    const f = fakeFetch((c) => (isTyphoon(c.url) ? typhoonOk() : geminiOk()));
    setExtractionFetchForTest(f);
    const r = await runExtraction(image, "image/jpeg", { retryBaseMs: 0, settings: live });
    expect(r.source).toBe("live");
    expect(f.calls).toHaveLength(2);
  });
});
