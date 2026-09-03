import { describe, it, expect } from "vitest";
import { ProviderError, type FetchLike } from "../src/modules/extract/providers/common.js";
import { TYPHOON_OCR_PROMPT, typhoonOcr } from "../src/modules/extract/providers/typhoon.js";

interface Call { url: string; init: RequestInit }

/** Offline fetch: records every call and answers from the handler. */
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

const completion = (content: string | null) => json({ choices: [{ message: { role: "assistant", content } }] });

const IMAGE_B64 = Buffer.from("fake-png-bytes").toString("base64");

describe("typhoonOcr", () => {
  it("sends the official v1.5 prompt + image data URI with the documented params and returns Markdown", async () => {
    const f = fakeFetch(() => completion("  # ใบรับรองแพทย์\n\nผู้ป่วย: สมชาย ใจดี  \n"));
    const out = await typhoonOcr({ imageBase64: IMAGE_B64, mime: "image/png" }, { apiKey: "typhoon-test-key", fetchImpl: f, retryBaseMs: 0 });

    expect(out).toEqual({ markdown: "# ใบรับรองแพทย์\n\nผู้ป่วย: สมชาย ใจดี", model: "typhoon-ocr" });
    expect(f.calls).toHaveLength(1);

    const call = f.calls[0]!;
    expect(call.url).toBe("https://api.opentyphoon.ai/v1/chat/completions");
    expect(call.init.method).toBe("POST");
    const headers = new Headers(call.init.headers);
    expect(headers.get("authorization")).toBe("Bearer typhoon-test-key");
    expect(headers.get("content-type")).toBe("application/json");

    const body = JSON.parse(call.init.body as string) as {
      model: string;
      messages: { role: string; content: { type: string; text?: string; image_url?: { url: string } }[] }[];
      max_tokens: number; temperature: number; top_p: number; repetition_penalty: number;
    };
    expect(body.model).toBe("typhoon-ocr");
    expect(body.max_tokens).toBe(16384);
    expect(body.temperature).toBe(0.1);
    expect(body.top_p).toBe(0.6);
    expect(body.repetition_penalty).toBe(1.1);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]!.role).toBe("user");
    const [text, image] = body.messages[0]!.content;
    expect(text).toEqual({ type: "text", text: TYPHOON_OCR_PROMPT });
    expect(text!.text).toContain("Extract all text from the image.");
    expect(text!.text).toContain("Describe in Thai.");
    expect(text!.text).not.toContain("{figure_language}");
    expect(image!.type).toBe("image_url");
    expect(image!.image_url!.url).toBe(`data:image/png;base64,${IMAGE_B64}`);
  });

  it("retries a 429 and succeeds on the next attempt", async () => {
    const f = fakeFetch((_c, i) => (i === 0 ? json({ error: "rate limited" }, 429) : completion("ok text")));
    const out = await typhoonOcr({ imageBase64: IMAGE_B64, mime: "image/jpeg" }, { apiKey: "k", fetchImpl: f, retryBaseMs: 0 });
    expect(out.markdown).toBe("ok text");
    expect(f.calls).toHaveLength(2);
  });

  it("retries network errors and 5xx up to 3 times, then throws a retryable ProviderError", async () => {
    const f = fakeFetch((_c, i) => {
      if (i === 0) throw new TypeError("fetch failed");
      return json({ error: "upstream" }, 503);
    });
    const err = await typhoonOcr({ imageBase64: IMAGE_B64, mime: "image/jpeg" }, { apiKey: "k", fetchImpl: f, retryBaseMs: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).provider).toBe("typhoon");
    expect((err as ProviderError).status).toBe(503);
    expect((err as ProviderError).retryable).toBe(true);
    expect(f.calls).toHaveLength(4); // 1 + 3 retries
  });

  it("does not retry a 4xx (other than 429/408)", async () => {
    const f = fakeFetch(() => json({ error: "bad key" }, 401));
    const err = await typhoonOcr({ imageBase64: IMAGE_B64, mime: "image/jpeg" }, { apiKey: "k", fetchImpl: f, retryBaseMs: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).status).toBe(401);
    expect((err as ProviderError).retryable).toBe(false);
    expect(f.calls).toHaveLength(1);
  });

  it("throws (without retrying) when the completion has empty or missing content", async () => {
    for (const res of [completion(""), completion("   \n"), completion(null), json({ choices: [] }), json({})]) {
      const f = fakeFetch(() => res.clone());
      const err = await typhoonOcr({ imageBase64: IMAGE_B64, mime: "image/jpeg" }, { apiKey: "k", fetchImpl: f, retryBaseMs: 0 }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toContain("empty OCR output");
      expect(f.calls).toHaveLength(1);
    }
  });
});
