import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { makeTestApp, registerUser, type TestApp } from "./helpers/app.js";

let t: TestApp;
beforeAll(async () => { t = await makeTestApp(); });
afterAll(async () => { await t.close(); });

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("auth", () => {
  it("registers, rejects duplicate email, logs in", async () => {
    const r1 = await t.agent.post("/api/v1/auth/register").send({ email: "auth@t.com", password: "password123" });
    expect(r1.status).toBe(201);
    expect(r1.body.accessToken).toBeTruthy();

    const dup = await t.agent.post("/api/v1/auth/register").send({ email: "auth@t.com", password: "password123" });
    expect(dup.status).toBe(409);

    const login = await t.agent.post("/api/v1/auth/login").send({ email: "auth@t.com", password: "password123" });
    expect(login.status).toBe(200);

    const bad = await t.agent.post("/api/v1/auth/login").send({ email: "auth@t.com", password: "wrong" });
    expect(bad.status).toBe(401);
  });

  it("rotates refresh tokens and detects reuse", async () => {
    const u = await registerUser(t, "rotate@t.com");
    const r1 = await t.agent.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(u.refreshToken);
    // reusing the old (now revoked) token fails and revokes the family
    const reuse = await t.agent.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken });
    expect(reuse.status).toBe(401);
    // the rotated token is now also revoked (family kill)
    const after = await t.agent.post("/api/v1/auth/refresh").send({ refreshToken: r1.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it("blocks protected routes without a token", async () => {
    const res = await t.agent.get("/api/v1/me");
    expect(res.status).toBe(401);
  });
});

describe("profile + emergency card", () => {
  it("saves an encrypted profile, an allergy, and builds the card", async () => {
    const u = await registerUser(t, "card@t.com");
    const h = bearer(u.accessToken);

    const put = await t.agent.put("/api/v1/me/profile").set(h).send({
      firstNameTh: "สมชาย", lastNameTh: "ใจดี", bloodAbo: "O", bloodRh: "neg",
    });
    expect(put.status).toBe(200);
    expect(put.body.firstNameTh).toBe("สมชาย"); // decrypted round-trip (ciphertext at rest covered by fieldEncryption tests)

    const allergy = await t.agent.post("/api/v1/me/allergies").set(h).send({
      substanceTh: "เพนิซิลลิน", severity: "severe",
    });
    expect(allergy.status).toBe(201);

    const fields = await t.agent.put("/api/v1/me/lock-screen-fields").set(h).send({
      name: true, bloodType: true, allergies: true, conditions: false, medications: false, contact: false,
    });
    expect(fields.status).toBe(200);

    const card = await t.agent.get("/api/v1/me/emergency-card").set(h);
    expect(card.status).toBe(200);
    const kinds = (card.body.lines as { kind: string; urgent: boolean }[]).map((l) => l.kind);
    expect(kinds).toContain("allergy");
    expect(card.body.emergencyUrl).toContain("/e/");
    expect(card.body.qrPngDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(card.body.shareLinkId).toBeTruthy();
  });
});

describe("records + extraction", () => {
  it("uploads, dedupes, extracts (mock), and reviews a record", async () => {
    const u = await registerUser(t, "rec@t.com");
    const h = bearer(u.accessToken);
    const image = Buffer.from("fake-jpeg-bytes-for-test-" + "x".repeat(1000));
    const sha = createHash("sha256").update(image).digest("hex");

    const create = await t.agent.post("/api/v1/records").set(h).send({
      kind: "sick_leave", sha256: sha, sizeBytes: image.length, mime: "image/jpeg",
    });
    expect(create.status).toBe(201);
    const recordId: string = create.body.recordId;

    // duplicate sha -> 409
    const dup = await t.agent.post("/api/v1/records").set(h).send({
      sha256: sha, sizeBytes: image.length, mime: "image/jpeg",
    });
    expect(dup.status).toBe(409);

    // upload bytes with a matching hash
    const blob = await t.agent.put(`/api/v1/records/${recordId}/blob`).set(h).set("Content-Type", "image/jpeg").send(image);
    expect(blob.status).toBe(200);

    // hash mismatch is rejected
    const bad = await t.agent.put(`/api/v1/records/${recordId}/blob`).set(h).set("Content-Type", "image/jpeg").send(Buffer.from("different"));
    expect(bad.status).toBe(400);

    const confirm = await t.agent.post(`/api/v1/records/${recordId}/confirm`).set(h);
    expect(confirm.status).toBe(200);

    const extract = await t.agent.post(`/api/v1/records/${recordId}/extract`).set(h);
    expect(extract.status).toBe(200);
    expect(extract.body.source).toBe("mock");
    expect(extract.body.needsReview).toBe(true); // the smudged licence field is low-confidence
    expect(extract.body.fieldMeta.doctor_license_no.band).toBe("low");

    const review = await t.agent.put(`/api/v1/records/${recordId}`).set(h).send({
      kind: "sick_leave", facility: "โรงพยาบาลตัวอย่าง", doctorLicenseNo: "ว.12345", issuedAt: "2026-09-03",
    });
    expect(review.status).toBe(200);
    expect(review.body.status).toBe("reviewed");
    expect(review.body.validUntil).toBe("2026-10-03"); // +1 month default

    const list = await t.agent.get("/api/v1/records").set(h);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].facility).toBe("โรงพยาบาลตัวอย่าง");

    const del = await t.agent.delete(`/api/v1/records/${recordId}`).set(h);
    expect(del.status).toBe(200);
    const list2 = await t.agent.get("/api/v1/records").set(h);
    expect(list2.body.length).toBe(0);
  });
});

describe("no known drug allergies vs the allergy list", () => {
  it("adding an allergy clears the flag, and the flag is refused while allergies exist", async () => {
    const u = await registerUser(t, "nkda@t.com");
    const h = bearer(u.accessToken);

    const put = await t.agent.put("/api/v1/me/profile").set(h).send({ nameEn: "Somchai", noKnownDrugAllergy: true });
    expect(put.status).toBe(200);
    expect(put.body.noKnownDrugAllergy).toBe(true);

    // a profile save that omits the flag leaves it untouched
    const again = await t.agent.put("/api/v1/me/profile").set(h).send({ nameEn: "Somchai J." });
    expect(again.status).toBe(200);
    expect(again.body.noKnownDrugAllergy).toBe(true);

    const allergy = await t.agent.post("/api/v1/me/allergies").set(h).send({ substanceEn: "Penicillin", severity: "severe" });
    expect(allergy.status).toBe(201);
    const profile = await t.agent.get("/api/v1/me/profile").set(h);
    expect(profile.body.noKnownDrugAllergy).toBe(false);

    const refused = await t.agent.put("/api/v1/me/no-known-drug-allergy").set(h).send({ value: true });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe("ALLERGIES_EXIST");
    const refusedViaProfile = await t.agent.put("/api/v1/me/profile").set(h).send({ nameEn: "Somchai", noKnownDrugAllergy: true });
    expect(refusedViaProfile.status).toBe(400);
    expect(refusedViaProfile.body.code).toBe("ALLERGIES_EXIST");

    // the card shows the real allergy, never the "none known" line
    const card = await t.agent.get("/api/v1/me/emergency-card").set(h);
    const allergyLines = (card.body.lines as { kind: string; value: string; urgent: boolean }[]).filter((l) => l.kind === "allergy");
    expect(allergyLines).toHaveLength(1);
    expect(allergyLines[0]!.urgent).toBe(true);
    expect(allergyLines[0]!.value).toContain("Penicillin");

    // once the list is empty again the flag can be set through its own endpoint
    const del = await t.agent.delete(`/api/v1/me/allergies/${allergy.body.id}`).set(h);
    expect(del.status).toBe(200);
    const set = await t.agent.put("/api/v1/me/no-known-drug-allergy").set(h).send({ value: true });
    expect(set.status).toBe(200);
    expect(set.body.noKnownDrugAllergy).toBe(true);
  });

  it("needs a profile before the flag can be set", async () => {
    const u = await registerUser(t, "nkda-noprofile@t.com");
    const res = await t.agent.put("/api/v1/me/no-known-drug-allergy").set(bearer(u.accessToken)).send({ value: true });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NO_PROFILE");
  });
});
