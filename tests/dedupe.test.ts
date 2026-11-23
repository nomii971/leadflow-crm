import { describe, expect, it } from "vitest";
import { decide, findMatch, keysFor, buildUpdatePatch } from "@/lib/leads/dedupe";
import { autoMapColumns } from "@/lib/leads/fields";
import { mapAndValidateRow } from "@/lib/leads/validate";
import { escapeFormula, sanitizeCell } from "@/lib/csv/sanitize";

const existing = [{ id: "A", linkedin_url_norm: "linkedin.com/in/jane", email_norm: "jane@acme.com", name_company_key: "jane doe|acme" }];
const lead = (o: Record<string, string | null>) => ({ linkedin_url: null, business_email: null, full_name: "Someone", company_name: null, ...o });

describe("duplicate detection", () => {
  it("matches by LinkedIn URL, email, then name + company", () => {
    expect(findMatch(keysFor(lead({ linkedin_url: "https://www.linkedin.com/in/jane/" })), existing)?.type).toBe("linkedin_url");
    expect(findMatch(keysFor(lead({ business_email: "JANE@acme.com" })), existing)?.type).toBe("email");
    expect(findMatch(keysFor(lead({ full_name: "Jane Doe", company_name: "ACME Ltd" })), existing)?.type).toBe("name_company");
    expect(findMatch(keysFor(lead({ full_name: "Jane Doe", company_name: "Acme", linkedin_url: "linkedin.com/in/other" })), existing)).toBeNull();
  });
  it("never auto-merges uncertain matches", () => {
    const m = { lead: existing[0], type: "name_company" as const };
    expect(decide(m, "update_existing").action).toBe("review");
    expect(decide(m, "skip_duplicates").action).toBe("review");
    expect(decide({ lead: existing[0], type: "email" }, "update_existing").action).toBe("update");
    expect(decide(m, "keep_both").action).toBe("insert");
    expect(decide(m, "new_only").action).toBe("skip");
  });
  it("update patch keeps status/notes and ignores empty values", () => {
    const p = buildUpdatePatch({ full_name: "X", job_title: null, status: "won", notes: "n" } as never);
    expect(p).toEqual({ full_name: "X" });
  });
});

describe("import mapping & validation", () => {
  it("auto-maps common Sales Navigator / CRM export headers", () => {
    const m = autoMapColumns(["First Name", "Last Name", "Title", "Company", "LinkedIn Profile URL", "Email Address", "City", "Country", "Random"]);
    expect(m).toMatchObject({ "First Name": "first_name", "Last Name": "last_name", Title: "job_title", Company: "company_name", "LinkedIn Profile URL": "linkedin_url", "Email Address": "business_email", City: "city", Country: "country", Random: "" });
  });
  it("validates and reports errors instead of dropping rows", () => {
    const map = { Name: "full_name", Email: "business_email", Status: "status" } as const;
    const ok = mapAndValidateRow({ Name: "Ali Khan", Email: "ali@x.pk", Status: "Interested" }, map as never);
    expect(ok.ok && ok.lead.status).toBe("interested");
    expect(ok.ok && ok.lead.first_name).toBe("Ali");
    const bad = mapAndValidateRow({ Name: "", Email: "nope", Status: "weird" }, map as never);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBeGreaterThanOrEqual(2);
  });
  it("sanitizes cells and escapes formulas on export", () => {
    expect(sanitizeCell("  a\u0000b ")).toBe("ab");
    expect(escapeFormula("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(escapeFormula("+44 20 7946 0000")).toBe("+44 20 7946 0000");
    expect(escapeFormula("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(escapeFormula("-2+3")).toBe("'-2+3");
    expect(escapeFormula("Normal")).toBe("Normal");
  });
});

describe("country normalisation", () => {
  it("stores aliases under the canonical country name", () => {
    const r = mapAndValidateRow({ N: "A B", C: "UAE" }, { N: "full_name", C: "country" } as never);
    expect(r.ok && r.lead.country).toBe("United Arab Emirates");
    const r2 = mapAndValidateRow({ N: "A B", C: "Narnia" }, { N: "full_name", C: "country" } as never);
    expect(r2.ok && r2.lead.country).toBe("Narnia");
  });
});
