import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { makeTestApp, registerUser, type TestApp } from "./helpers/app.js";
import { sendEmail, alertEmailContent, RESEND_URL } from "../src/modules/alerts/email.js";
import { setAlertEmailForTest } from "../src/modules/alerts/service.js";
import { ProviderError, type FetchLike } from "../src/modules/extract/providers/common.js";

interface Call { url: string; method: string; headers: Record<string, string>; body: unknown }

function fakeFetch(queue: Array<() => Response>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const next = queue.shift();
    if (!next) throw new Error("fake fetch: no canned response left");
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => { headers[k] = v; });
    calls.push({ url: String(input), method: init?.method ?? "GET", headers, body: init?.body ? JSON.parse(String(init.body)) : null });
    return next();
  };
  return { calls, fetchImpl };
}
const json = (obj: unknown, status = 200) => () => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const waitFor = async (pred: () => boolean, ms = 2000) => { const t0 = Date.now(); while (!pred() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 20)); };

describe("sendEmail (Resend)", () => {
  it("posts from/to/subject/text/html with the bearer key", async () => {
    const f = fakeFetch([json({ id: "em_1" })]);
    const r = await sendEmail({ to: "owner@t.com", subject: "S", text: "T", html: "<p>T</p>" }, { apiKey: "re_k", from: "onboarding@resend.dev", fetchImpl: f.fetchImpl, retryBaseMs: 0 });
    expect(r.id).toBe("em_1");
    expect(f.calls[0]?.url).toBe(RESEND_URL);
    expect(f.calls[0]?.headers.authorization).toBe("Bearer re_k");
    expect(f.calls[0]?.body).toMatchObject({ from: "onboarding@resend.dev", to: ["owner@t.com"], subject: "S", text: "T", html: "<p>T</p>" });
  });

  it("retries a 500 then succeeds, and does not retry a 403 (free-tier restriction)", async () => {
    const f = fakeFetch([json({ message: "boom" }, 500), json({ id: "em_2" })]);
    const r = await sendEmail({ to: "a@t.com", subject: "S", text: "T" }, { apiKey: "k", from: "f@x", fetchImpl: f.fetchImpl, retryBaseMs: 0 });
    expect(r.id).toBe("em_2"); expect(f.calls).toHaveLength(2);
    const g = fakeFetch([json({ message: "You can only send testing emails to your own email address" }, 403)]);
    await expect(sendEmail({ to: "b@t.com", subject: "S", text: "T" }, { apiKey: "k", from: "f@x", fetchImpl: g.fetchImpl, retryBaseMs: 0 }))
      .rejects.toMatchObject({ provider: "resend", status: 403, retryable: false });
    expect(g.calls).toHaveLength(1);
    await expect(sendEmail({ to: "b@t.com", subject: "S", text: "T" }, { apiKey: "k", from: "f@x", fetchImpl: fakeFetch([json({}, 403)]).fetchImpl, retryBaseMs: 0 }))
      .rejects.toBeInstanceOf(ProviderError);
  });

  it("builds bilingual content for every alert kind", () => {
    for (const kind of ["card_viewed", "share_viewed", "share_revoked", "expiry", "follow_up"] as const) {
      const c = alertEmailContent(kind, new Date("2026-09-04T10:00:00Z"));
      expect(c.subject.startsWith("MediFirstCard: ")).toBe(true);
      expect(c.text).toContain("040333215");
      expect(c.html).toContain("</div>");
    }
    expect(alertEmailContent("card_viewed", new Date("2026-09-04T10:00:00Z")).text).toContain("17:00"); // Bangkok time
  });
});

describe("alert e-mail on public-page views", () => {
  let t: TestApp;
  beforeAll(async () => { t = await makeTestApp(); });
  afterAll(async () => { await t.close(); });
  afterEach(() => setAlertEmailForTest(null));
  const H = (tok: string) => ({ Authorization: `Bearer ${tok}` });

  async function cardToken(email: string) {
    const u = await registerUser(t, email);
    await t.agent.put("/api/v1/me/profile").set(H(u.accessToken)).send({ firstNameTh: "สมชาย", bloodAbo: "A" });
    const card = await t.agent.get("/api/v1/me/emergency-card").set(H(u.accessToken));
    return (card.body.emergencyUrl as string).split("/e/")[1] as string;
  }

  it("mails the card owner at their own account address when Resend is configured", async () => {
    const token = await cardToken("owner-mail@test.dev");
    const f = fakeFetch([json({ id: "em_3" })]);
    setAlertEmailForTest({ apiKey: "re_test", from: "onboarding@resend.dev", fetchImpl: f.fetchImpl, retryBaseMs: 0 });
    const view = await t.agent.get(`/e/${token}.json`);
    expect(view.status).toBe(200);
    await waitFor(() => f.calls.length === 1);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.body).toMatchObject({ to: ["owner-mail@test.dev"] });
    expect((f.calls[0]?.body as { subject: string }).subject).toContain("Your emergency card was viewed");
  });

  it("uses ALERT_EMAIL_TO as the recipient when set (free-tier demo), and the page never fails on mail errors", async () => {
    const token = await cardToken("owner2@test.dev");
    const f = fakeFetch([json({ message: "testing emails only" }, 403)]);
    setAlertEmailForTest({ apiKey: "re_test", from: "onboarding@resend.dev", overrideTo: "demo-owner@test.dev", fetchImpl: f.fetchImpl, retryBaseMs: 0 });
    const view = await t.agent.get(`/e/${token}.json`);
    expect(view.status).toBe(200);
    await waitFor(() => f.calls.length === 1);
    expect(f.calls[0]?.body).toMatchObject({ to: ["demo-owner@test.dev"] });
  });

  it("sends nothing without a Resend key (in-app notification only)", async () => {
    const token = await cardToken("owner3@test.dev");
    const f = fakeFetch([json({ id: "never" })]);
    setAlertEmailForTest({ apiKey: undefined, from: "onboarding@resend.dev", fetchImpl: f.fetchImpl });
    expect((await t.agent.get(`/e/${token}.json`)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    expect(f.calls).toHaveLength(0);
  });
});
