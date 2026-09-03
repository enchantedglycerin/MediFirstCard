import { describe, it, expect } from "vitest";
import { beYearToCE, ceYearToBE, formatBE, isFutureDate } from "../src/dates/be.js";
import { isValidThaiId } from "../src/schemas/profile.js";
import { defaultValidUntil, kindFromDocumentType } from "../src/schemas/records.js";

describe("buddhist era", () => {
  it("converts BE to CE and back", () => {
    expect(beYearToCE(2569)).toBe(2026);
    expect(ceYearToBE(2026)).toBe(2569);
    expect(beYearToCE(2026)).toBe(2026); // already CE, untouched
  });

  it("formats a CE ISO date for Thai and English display", () => {
    expect(formatBE("2026-09-03", "th")).toBe("3 กันยายน 2569 (2026)");
    expect(formatBE("2026-09-03", "en")).toBe("3 September 2026");
    expect(formatBE("not-a-date", "th")).toBe("not-a-date");
  });

  it("detects future dates", () => {
    expect(isFutureDate("2027-01-01", "2026-09-03")).toBe(true);
    expect(isFutureDate("2026-09-03", "2026-09-03")).toBe(false);
  });
});

describe("thai national id checksum", () => {
  it("accepts a valid id and rejects a bad one", () => {
    expect(isValidThaiId("1101700230708")).toBe(true); // valid mod-11 checksum (check digit 8)
    expect(isValidThaiId("1101700230700")).toBe(false);
    expect(isValidThaiId("123")).toBe(false);
  });
});

describe("record kind + validity", () => {
  it("maps extraction document types to record kinds", () => {
    expect(kindFromDocumentType("medical_certificate_sick_leave")).toBe("sick_leave");
    expect(kindFromDocumentType("medication_label")).toBe("prescription");
    expect(kindFromDocumentType("not_medical")).toBeNull();
  });

  it("defaults certificate validity to one month from issue", () => {
    expect(defaultValidUntil("certificate_general", "2026-09-03")).toBe("2026-10-03");
    expect(defaultValidUntil("lab", "2026-09-03")).toBeUndefined();
  });
});
