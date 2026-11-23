import { sameCountry, samePlace } from "@/lib/locations";
import type { CollectorConfig, LocationSelection, ProfessionalFilters, SourceRecord } from "./types";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).toLowerCase().trim();
const contains = (hay: unknown, needles: string[] | undefined) =>
  !needles || needles.length === 0 || needles.some((n) => s(hay).includes(s(n)));
const equalsAny = (v: unknown, opts: string[] | undefined) =>
  !opts || opts.length === 0 || opts.some((o) => s(o) === s(v));

export function matchesLocation(rec: SourceRecord["data"], locations: LocationSelection[]) {
  if (!locations || locations.length === 0) return true;
  return locations.some((loc) => {
    if (!sameCountry(String(rec.country ?? ""), loc.country)) return false;
    if (loc.state && !samePlace(String(rec.state ?? ""), loc.state)) return false;
    if (loc.city && !samePlace(String(rec.city ?? ""), loc.city)) return false;
    if (loc.region && !s(rec.region).includes(s(loc.region))) return false;
    return true;
  });
}

export function matchesProfessional(rec: SourceRecord["data"], f: ProfessionalFilters) {
  if (!contains(rec.job_title, f.jobTitles)) return false;
  if (!contains(rec.industry, f.industries)) return false;
  if (!contains(rec.company_name, f.companyNames)) return false;
  if (!equalsAny(rec.company_size, f.companySizes)) return false;
  if (!contains(rec.seniority, f.seniorities)) return false;
  if (!contains(rec.department, f.departments)) return false;
  if (f.keywords && f.keywords.trim()) {
    const text = Object.values(rec).map(s).join(" ");
    const words = f.keywords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (!words.every((w) => text.includes(w))) return false;
  }
  return true;
}

export const matchesConfig = (rec: SourceRecord["data"], config: CollectorConfig) =>
  matchesLocation(rec, config.locations ?? []) && matchesProfessional(rec, config.filters ?? {});

export function describeConfig(config: CollectorConfig): string {
  const parts: string[] = [];
  const locs = config.locations ?? [];
  if (locs.length) {
    parts.push(
      locs
        .map((l) => [l.city, l.state, l.country].filter(Boolean).join(", "))
        .slice(0, 6)
        .join(" · ") + (locs.length > 6 ? ` +${locs.length - 6}` : ""),
    );
  }
  const f = config.filters ?? {};
  if (f.jobTitles?.length) parts.push(`Title: ${f.jobTitles.join(", ")}`);
  if (f.industries?.length) parts.push(`Industry: ${f.industries.join(", ")}`);
  if (f.companyNames?.length) parts.push(`Company: ${f.companyNames.join(", ")}`);
  if (f.companySizes?.length) parts.push(`Size: ${f.companySizes.join(", ")}`);
  if (f.seniorities?.length) parts.push(`Seniority: ${f.seniorities.join(", ")}`);
  if (f.departments?.length) parts.push(`Dept: ${f.departments.join(", ")}`);
  if (f.keywords) parts.push(`Keywords: ${f.keywords}`);
  return parts.join(" | ") || "No filters (all records)";
}
