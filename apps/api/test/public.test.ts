import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { makeTestApp, registerUser, type TestApp } from "./helpers/app.js";

let t: TestApp;
beforeAll(async () => { t = await makeTestApp(); });
afterAll(async () => { await t.close(); });
const H = (tok: string) => ({ Authorization: `Bearer ${tok}` });

async function seedUserWithCard(email: string) {
  const u = await registerUser(t, email);
  const h = H(u.accessToken);
  await t.agent.put("/api/v1/me/profile").set(h).send({ firstNameTh: "สมชาย", bloodAbo: "O", bloodRh: "neg" });
  await t.agent.post("/api/v1/me/allergies").set(h).send({ substanceTh: "เพนิซิลลิน", severity: "severe" });
  await t.agent.post("/api/v1/me/contacts").set(h).send({ name: "แม่", relationship: "mother", phone: "0812345678" });
  const card = await t.agent.get("/api/v1/me/emergency-card").set(h);
  const token = (card.body.emergencyUrl as string).split("/e/")[1];
  return { u, h, token: token as string };
}

describe("public emergency page", () => {
  it("serves the rescuer JSON + HTML and logs a card-viewed alert", async () => {
    const { h, token } = await seedUserWithCard("pub1@t.com");

    const json = await t.agent.get(`/e/${token}.json`);
    expect(json.status).toBe(200);
    const kinds = (json.body.lines as { kind: string }[]).map((l) => l.kind);
    expect(kinds).toContain("allergy");

    const html = await t.agent.get(`/e/${token}`);
    expect(html.status).toBe(200);
    expect(html.text).toContain("เพนิซิลลิน");

    const qr = await t.agent.get(`/e/${token}/qr.png`);
    expect(qr.status).toBe(200);
    expect(qr.headers["content-type"]).toContain("image/png");

    // two views -> two card_viewed notifications for the owner
    const notes = await t.agent.get("/api/v1/me/notifications").set(h);
    expect(notes.status).toBe(200);
    expect(notes.body.filter((n: { kind: string }) => n.kind === "card_viewed").length).toBeGreaterThanOrEqual(2);
  });

  it("renders tap-to-call links for the emergency contact and the 1669 EMS button", async () => {
    const { token } = await seedUserWithCard("public-tel@test.dev");
    const html = await t.agent.get(`/e/${token}`);
    expect(html.status).toBe(200);
    expect(html.text).toContain('href="tel:0812345678"');
    expect(html.text).toContain('href="tel:1669"');
    const json = await t.agent.get(`/e/${token}.json`);
    const contact = (json.body.lines as Array<{ kind: string; phone?: string }>).find((l) => l.kind === "contact");
    expect(contact?.phone).toBe("0812345678");
  });

  it("returns 404 for an unknown token", async () => {
    const res = await t.agent.get("/e/not-a-real-token.json");
    expect(res.status).toBe(404);
  });
});

describe("clinician share link", () => {
  it("creates, opens, then revokes a records link", async () => {
    const u = await registerUser(t, "share@t.com");
    const h = H(u.accessToken);
    // make a record to share
    const img = Buffer.from("share-img-" + "z".repeat(300));
    const sha = createHash("sha256").update(img).digest("hex");
    const cr = await t.agent.post("/api/v1/records").set(h).send({ kind: "sick_leave", sha256: sha, sizeBytes: img.length, mime: "image/jpeg" });
    await t.agent.put(`/api/v1/records/${cr.body.recordId}/blob`).set(h).set("Content-Type", "image/jpeg").send(img);
    await t.agent.put(`/api/v1/records/${cr.body.recordId}`).set(h).send({ kind: "sick_leave", facility: "รพ. ตัวอย่าง", issuedAt: "2026-09-03" });

    const link = await t.agent.post("/api/v1/share-links").set(h).send({ recordIds: [cr.body.recordId], ttlHours: 24 });
    expect(link.status).toBe(201);
    const token = (link.body.url as string).split("/s/")[1];

    const view = await t.agent.get(`/s/${token}`);
    expect(view.status).toBe(200);
    expect(view.text).toContain("รพ. ตัวอย่าง");
    expect(view.text).toContain("ใบรับรองแพทย์ลาป่วย"); // localized kind, not the enum key
    expect(view.text).not.toContain(">sick_leave<");
    const imgSrc = view.text.match(/src="([^"]+\/records\/[^"]+\/image[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
    expect(imgSrc).toBeTruthy();

    // the browser fetches the image without any auth: the signature in the URL is what admits it
    const imgRes = await t.agent.get(imgSrc as string).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on("data", (c: Buffer) => chunks.push(c)); res.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(imgRes.status).toBe(200);
    expect(imgRes.headers["content-type"]).toContain("image/jpeg");
    expect(Buffer.compare(imgRes.body as Buffer, img)).toBe(0); // the bytes that were uploaded
    const tampered = await t.agent.get((imgSrc as string).replace(/sig=[^&]+/, "sig=AAAA"));
    expect(tampered.status).toBe(403);
    const otherRecord = await t.agent.get((imgSrc as string).replace(cr.body.recordId as string, "00000000-0000-0000-0000-000000000000"));
    expect(otherRecord.status).toBe(403);

    const revoke = await t.agent.post(`/api/v1/share-links/${link.body.id}/revoke`).set(h);
    expect(revoke.status).toBe(200);

    const after = await t.agent.get(`/s/${token}`);
    expect(after.status).toBe(410); // expired/revoked
    const imgAfter = await t.agent.get(imgSrc as string);
    expect(imgAfter.status).toBe(410); // the image dies with the link

    const log = await t.agent.get(`/api/v1/share-links/${link.body.id}/log`).set(h);
    expect(log.body.length).toBeGreaterThanOrEqual(2); // ok view + revoked view
  });
});

describe("consent + erasure", () => {
  it("records consent, and account deletion removes the user", async () => {
    const { u, h } = await seedUserWithCard("erase@t.com");
    const consent = await t.agent.post("/api/v1/me/consent").set(h).send({
      version: 1, granted: true, purposes: { lockScreen: true, records: true, ai: true },
    });
    expect(consent.status).toBe(201);

    const del = await t.agent.delete("/api/v1/me").set(h);
    expect(del.status).toBe(200);

    // login with the deleted account now fails
    const login = await t.agent.post("/api/v1/auth/login").send({ email: u.email, password: "password123" });
    expect(login.status).toBe(401);
  });
});
