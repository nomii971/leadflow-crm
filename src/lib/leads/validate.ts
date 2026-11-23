import { z } from "zod";
import { LEAD_STATUSES, PRIORITY_VALUES, STATUS_VALUES } from "@/lib/constants";
import { sanitizeCell } from "@/lib/csv/sanitize";
import type { LeadFieldKey } from "./fields";
import { splitName, toHttpUrl } from "./normalize";
import { findCountry } from "@/lib/locations";

const optStr = (max = 500) =>
  z.string().max(max).nullish().transform((v) => (v === undefined || v === null || v.trim() === "" ? null : v.trim()));

const emailField = (msg: string) =>
  optStr(320)
    .transform((v) => (v ? v.replace(/^mailto:/i, "").trim() : v))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg);
const phoneField = (msg: string) =>
  optStr(60)
    .transform((v) => (v ? v.replace(/^tel:/i, "").trim() : v))
    .refine((v) => !v || /^[+()\d\s.\-x/ext]{5,60}$/i.test(v), msg);

const optDate = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: `Invalid date "${v}"` });
      return z.NEVER;
    }
    return d.toISOString();
  });

export const leadInputSchema = z
  .object({
    full_name: optStr(300),
    first_name: optStr(150),
    last_name: optStr(150),
    job_title: optStr(300),
    company_name: optStr(300),
    industry: optStr(200),
    country: optStr(120),
    state: optStr(120),
    city: optStr(120),
    region: optStr(200),
    linkedin_url: optStr(500).refine(
      (v) => !v || /linkedin\.com\//i.test(v),
      "LinkedIn URL must point to linkedin.com",
    ),
    company_website: optStr(500),
    business_email: emailField("Invalid email address"),
    business_phone: phoneField("Invalid phone number"),
    personal_email: emailField("Invalid personal email"),
    mobile_phone: phoneField("Invalid mobile number"),
    company_email: emailField("Invalid company email"),
    company_phone: phoneField("Invalid company phone"),
    company_size: optStr(60),
    seniority: optStr(100),
    department: optStr(150),
    lead_source: optStr(200),
    source_reference: optStr(1000),
    status: z.enum(STATUS_VALUES).default("new"),
    priority: z.enum(PRIORITY_VALUES).default("medium"),
    notes: optStr(10000),
    last_contacted_at: optDate,
    collected_at: optDate,
    email_verified: z.boolean().default(false),
    phone_verified: z.boolean().default(false),
    is_verified: z.boolean().default(false),
  })
  .transform((v) => {
    let { full_name, first_name, last_name } = v;
    if (!full_name && (first_name || last_name)) full_name = [first_name, last_name].filter(Boolean).join(" ");
    if (full_name && !first_name && !last_name) {
      const s = splitName(full_name);
      first_name = s.first;
      last_name = s.last;
    }
    return {
      ...v,
      full_name,
      first_name,
      last_name,
      // "UK", "UAE", "USA"... are stored under one canonical country name so filters and charts agree.
      country: v.country ? findCountry(v.country)?.name ?? v.country : null,
      company_website: toHttpUrl(v.company_website),
      linkedin_url: toHttpUrl(v.linkedin_url),
    };
  })
  .refine((v) => !!v.full_name, { message: "A name is required (Full Name or First/Last Name)", path: ["full_name"] });

export type LeadInput = z.output<typeof leadInputSchema>;

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "verified", "valid"]);

function coerceStatus(v: string): string {
  const s = v.toLowerCase().trim();
  if (!s) return "new";
  const byLabel = LEAD_STATUSES.find((x) => x.label.toLowerCase() === s || x.value === s.replace(/\s+/g, "_"));
  if (byLabel) return byLabel.value;
  if (["converted", "closed won", "customer"].includes(s)) return "won";
  if (["closed lost", "unqualified", "disqualified"].includes(s)) return "lost";
  if (["meeting", "meeting booked"].includes(s)) return "meeting_scheduled";
  if (["proposal"].includes(s)) return "proposal_sent";
  return s; // left as-is so validation reports it instead of silently changing it
}

/** Turns a raw CSV row + column mapping into a typed lead, or a list of human-readable errors. */
export function mapAndValidateRow(
  raw: Record<string, unknown>,
  mapping: Record<string, LeadFieldKey | "">,
  defaults: { lead_source?: string | null } = {},
): { ok: true; lead: LeadInput } | { ok: false; errors: string[] } {
  const obj: Record<string, unknown> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue;
    const val = sanitizeCell(raw[header]);
    if (val === "") continue;
    if (obj[field] !== undefined && obj[field] !== "") continue; // first non-empty wins
    obj[field] = val;
  }
  return validateLeadFields(obj, defaults);
}

/** Validates an object already keyed by CRM field names (used by source adapters). */
export function validateLeadFields(
  input: Record<string, unknown>,
  defaults: { lead_source?: string | null } = {},
): { ok: true; lead: LeadInput } | { ok: false; errors: string[] } {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "boolean") obj[k] = v;
    else {
      const c = sanitizeCell(v);
      if (c !== "") obj[k] = c;
    }
  }
  for (const b of ["email_verified", "phone_verified", "is_verified"] as const) {
    obj[b] = typeof obj[b] === "boolean" ? obj[b] : typeof obj[b] === "string" ? TRUE_WORDS.has((obj[b] as string).toLowerCase()) : false;
  }
  if (typeof obj.status === "string") obj.status = coerceStatus(obj.status);
  else delete obj.status;
  if (typeof obj.priority === "string") obj.priority = (obj.priority as string).toLowerCase().trim() || undefined;
  if (!obj.lead_source && defaults.lead_source) obj.lead_source = defaults.lead_source;

  const parsed = leadInputSchema.safeParse(obj);
  if (parsed.success) return { ok: true, lead: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`),
  };
}
