import { describe, expect, it } from "vitest";
import { nameCompanyKey, normCompany, normEmail, normUrl, splitName, toHttpUrl } from "@/lib/leads/normalize";

describe("normalisation", () => {
  it("normalises LinkedIn URLs", () => {
    expect(normUrl("https://uk.linkedin.com/in/jane-doe/?trk=x")).toBe("linkedin.com/in/jane-doe");
    expect(normUrl("HTTP://www.LinkedIn.com/in/Jane-Doe/")).toBe("linkedin.com/in/jane-doe");
    expect(normUrl("linkedin.com/in/jane-doe#about")).toBe("linkedin.com/in/jane-doe");
    expect(normUrl("  ")).toBeNull();
  });
  it("normalises emails", () => {
    expect(normEmail(" Jane@Acme.COM ")).toBe("jane@acme.com");
  });
  it("normalises company names and strips legal suffixes", () => {
    expect(normCompany("Acme Ltd.")).toBe("acme");
    expect(normCompany("ACME limited")).toBe("acme");
    expect(normCompany("Acme, Inc")).toBe("acme");
    expect(normCompany("Coca-Cola Company")).toBe("coca cola");
    expect(normCompany("Ltd")).toBeNull();
  });
  it("builds name+company keys only when both exist", () => {
    expect(nameCompanyKey("Jane  Doe", "Acme Ltd")).toBe("jane doe|acme");
    expect(nameCompanyKey("Jane", null)).toBeNull();
  });
  it("splits names and fixes URLs", () => {
    expect(splitName("Mary Ann Smith")).toEqual({ first: "Mary", last: "Ann Smith" });
    expect(toHttpUrl("acme.com")).toBe("https://acme.com");
    expect(toHttpUrl("https://acme.com")).toBe("https://acme.com");
  });
});

describe("unicode parity with SQL", () => {
  it("keeps accented letters", () => {
    expect(normCompany("Société Générale")).toBe("société générale");
  });
});
