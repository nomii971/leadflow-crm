// Canonical CRM lead fields, used by import mapping, tables and exports.

export type LeadFieldKey =
  | "full_name" | "first_name" | "last_name" | "job_title" | "company_name" | "industry"
  | "country" | "state" | "city" | "region" | "linkedin_url" | "company_website" | "business_email"
  | "business_phone" | "company_size" | "seniority" | "department" | "lead_source" | "source_reference"
  | "status" | "priority" | "notes" | "last_contacted_at" | "collected_at"
  | "email_verified" | "phone_verified" | "is_verified" | "created_at" | "origin";

export interface LeadFieldDef {
  key: LeadFieldKey;
  label: string;
  importable: boolean;
  aliases: string[]; // lower-cased header names used for automatic column detection
}

export const LEAD_FIELDS: LeadFieldDef[] = [
  { key: "full_name", label: "Full Name", importable: true, aliases: ["full name", "name", "contact name", "lead name", "person name"] },
  { key: "first_name", label: "First Name", importable: true, aliases: ["first name", "firstname", "given name", "first"] },
  { key: "last_name", label: "Last Name", importable: true, aliases: ["last name", "lastname", "surname", "family name", "last"] },
  { key: "job_title", label: "Job Title", importable: true, aliases: ["job title", "title", "position", "current title", "role", "headline", "jobtitle"] },
  { key: "company_name", label: "Company Name", importable: true, aliases: ["company", "company name", "account", "account name", "organization", "organisation", "current company", "employer"] },
  { key: "industry", label: "Industry", importable: true, aliases: ["industry", "company industry", "sector"] },
  { key: "country", label: "Country", importable: true, aliases: ["country", "country name", "location country"] },
  { key: "state", label: "State / Province", importable: true, aliases: ["state", "province", "state/province", "region/state", "county"] },
  { key: "city", label: "City", importable: true, aliases: ["city", "town", "location city", "locality"] },
  { key: "region", label: "Region", importable: true, aliases: ["region", "geography", "geo", "location", "area"] },
  { key: "linkedin_url", label: "LinkedIn Profile URL", importable: true, aliases: ["linkedin", "linkedin url", "linkedin profile", "linkedin profile url", "profile url", "person linkedin url", "sales navigator url", "lead url", "hs_linkedin_url"] },
  { key: "company_website", label: "Company Website", importable: true, aliases: ["website", "company website", "domain", "company domain", "url", "web site"] },
  { key: "business_email", label: "Business Email", importable: true, aliases: ["email", "business email", "work email", "email address", "e-mail", "corporate email"] },
  { key: "business_phone", label: "Business Phone", importable: true, aliases: ["phone", "business phone", "work phone", "phone number", "mobile", "telephone", "direct phone"] },
  { key: "company_size", label: "Company Size", importable: true, aliases: ["company size", "employees", "employee count", "headcount", "# employees", "number of employees", "size"] },
  { key: "seniority", label: "Seniority", importable: true, aliases: ["seniority", "seniority level", "level"] },
  { key: "department", label: "Department", importable: true, aliases: ["department", "function", "job function", "team"] },
  { key: "lead_source", label: "Lead Source", importable: true, aliases: ["lead source", "source", "data source"] },
  { key: "source_reference", label: "Source Reference", importable: true, aliases: ["source reference", "source id", "record id", "external id", "source url"] },
  { key: "status", label: "Lead Status", importable: true, aliases: ["status", "lead status", "stage"] },
  { key: "priority", label: "Priority", importable: true, aliases: ["priority"] },
  { key: "notes", label: "Notes", importable: true, aliases: ["notes", "note", "comments", "description"] },
  { key: "last_contacted_at", label: "Last Contacted", importable: true, aliases: ["last contacted", "last contact", "last contacted date", "last activity"] },
  { key: "collected_at", label: "Collected At", importable: true, aliases: ["collected at", "date collected", "collection date", "saved date", "date saved"] },
  { key: "email_verified", label: "Email Verified", importable: true, aliases: ["email verified", "email status", "verified email"] },
  { key: "phone_verified", label: "Phone Verified", importable: true, aliases: ["phone verified", "verified phone"] },
  { key: "is_verified", label: "Record Verified", importable: true, aliases: ["verified", "record verified"] },
  { key: "created_at", label: "Date Added", importable: false, aliases: [] },
  { key: "origin", label: "Origin", importable: false, aliases: [] },
];

export const IMPORTABLE_FIELDS = LEAD_FIELDS.filter((f) => f.importable);
export const fieldLabel = (k: string) => LEAD_FIELDS.find((f) => f.key === k)?.label ?? k;

const clean = (h: string) => h.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

/** Maps each CSV header to the best CRM field, never mapping two headers to the same field. */
export function autoMapColumns(headers: string[]): Record<string, LeadFieldKey | ""> {
  const mapping: Record<string, LeadFieldKey | ""> = {};
  const used = new Set<LeadFieldKey>();
  // exact alias matches first, then "contains" matches
  for (const pass of ["exact", "contains"] as const) {
    for (const h of headers) {
      if (mapping[h]) continue;
      const ch = clean(h);
      const match = IMPORTABLE_FIELDS.find(
        (f) =>
          !used.has(f.key) &&
          (pass === "exact"
            ? f.aliases.includes(ch) || clean(f.label) === ch || f.key.replace(/_/g, " ") === ch
            : f.aliases.some((a) => a.length > 3 && ch.includes(a))),
      );
      if (match) {
        mapping[h] = match.key;
        used.add(match.key);
      }
    }
  }
  for (const h of headers) if (!(h in mapping)) mapping[h] = "";
  return mapping;
}

export const DEFAULT_TABLE_COLUMNS: LeadFieldKey[] = [
  "full_name", "job_title", "company_name", "country", "city", "industry", "status", "priority", "created_at",
];

export const EXPORT_DEFAULT_COLUMNS: LeadFieldKey[] = [
  "full_name", "first_name", "last_name", "job_title", "company_name", "industry", "country", "state", "city",
  "linkedin_url", "company_website", "business_email", "business_phone", "company_size", "seniority",
  "department", "lead_source", "status", "priority", "created_at", "last_contacted_at", "notes",
];
