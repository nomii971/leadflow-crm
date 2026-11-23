import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chunk } from "@/lib/utils";

export const leadFiltersSchema = z.object({
  q: z.string().max(200).optional(),
  status: z.string().max(40).optional(),
  priority: z.string().max(20).optional(),
  country: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  industry: z.string().max(200).optional(),
  job_title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  origin: z.string().max(40).optional(),
  lead_source: z.string().max(200).optional(),
  seniority: z.string().max(100).optional(),
  list_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  collection_job_id: z.string().uuid().optional(),
  import_job_id: z.string().uuid().optional(),
  verified: z.enum(["yes", "no"]).optional(),
  has_email: z.enum(["yes", "no"]).optional(),
  has_phone: z.enum(["yes", "no"]).optional(),
  created_from: z.string().max(30).optional(),
  created_to: z.string().max(30).optional(),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export const SORTABLE = [
  "created_at", "updated_at", "full_name", "job_title", "company_name", "country", "city", "industry", "status",
  "priority", "last_contacted_at",
] as const;

export function parseLeadFilters(sp: Record<string, string | string[] | undefined> | URLSearchParams): LeadFilters {
  const obj: Record<string, string> = {};
  const entries = sp instanceof URLSearchParams ? Array.from(sp.entries()) : Object.entries(sp);
  for (const [k, v] of entries) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== "" && k in leadFiltersSchema.shape) obj[k] = val;
  }
  const parsed = leadFiltersSchema.safeParse(obj);
  return parsed.success ? parsed.data : {};
}

const likeEscape = (s: string) => s.replace(/[\\%_*]/g, (m) => (m === "*" ? "" : `\\${m}`)).trim();

// Generic over the PostgREST builder type; kept loose on purpose because the builder's generic types are deep.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyLeadFilters<Q extends { [k: string]: any }>(query: Q, f: LeadFilters): Q {
  let q = query;
  if (f.q) {
    const term = likeEscape(f.q.toLowerCase());
    if (term) q = q.ilike("search_text", `%${term}%`);
  }
  if (f.status) q = q.eq("status", f.status);
  if (f.priority) q = q.eq("priority", f.priority);
  if (f.country) q = q.ilike("country", likeEscape(f.country));
  if (f.city) q = q.ilike("city", likeEscape(f.city));
  if (f.industry) q = q.ilike("industry", `%${likeEscape(f.industry)}%`);
  if (f.job_title) q = q.ilike("job_title", `%${likeEscape(f.job_title)}%`);
  if (f.company) q = q.ilike("company_name", `%${likeEscape(f.company)}%`);
  if (f.seniority) q = q.ilike("seniority", `%${likeEscape(f.seniority)}%`);
  if (f.origin) q = q.eq("origin", f.origin);
  if (f.lead_source) q = q.ilike("lead_source", `%${likeEscape(f.lead_source)}%`);
  if (f.company_id) q = q.eq("company_id", f.company_id);
  if (f.collection_job_id) q = q.eq("collection_job_id", f.collection_job_id);
  if (f.import_job_id) q = q.eq("import_job_id", f.import_job_id);
  if (f.verified) q = q.eq("is_verified", f.verified === "yes");
  // "Has email / phone" looks at the person's and the company's contact fields.
  if (f.has_email === "yes") q = q.or("business_email.not.is.null,personal_email.not.is.null,company_email.not.is.null");
  if (f.has_email === "no") q = q.is("business_email", null).is("personal_email", null).is("company_email", null);
  if (f.has_phone === "yes") q = q.or("business_phone.not.is.null,mobile_phone.not.is.null,company_phone.not.is.null");
  if (f.has_phone === "no") q = q.is("business_phone", null).is("mobile_phone", null).is("company_phone", null);
  if (f.created_from) q = q.gte("created_at", f.created_from);
  if (f.created_to) q = q.lte("created_at", `${f.created_to}T23:59:59.999Z`);
  if (f.list_id) q = q.eq("lead_list_members.list_id", f.list_id);
  return q;
}

/** Column selection that also enables the list filter (inner join) when needed. */
export const leadSelect = (columns: string, f: LeadFilters) =>
  f.list_id ? `${columns}, lead_list_members!inner(list_id)` : columns;

export type BulkTarget = { ids: string[] } | { filters: LeadFilters };

export const bulkTargetSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) }),
  z.object({ filters: leadFiltersSchema }),
]);

/** Resolves a selection (explicit ids or "everything matching the filter") to lead ids, page by page. */
export async function resolveLeadIds(supabase: SupabaseClient, target: BulkTarget, cap = 100_000): Promise<string[]> {
  if ("ids" in target) return target.ids;
  const ids: string[] = [];
  const page = 1000;
  for (let from = 0; from < cap; from += page) {
    const q = applyLeadFilters(supabase.from("leads").select(leadSelect("id", target.filters)), target.filters)
      .order("id")
      .range(from, from + page - 1);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    ids.push(...((data ?? []) as unknown as { id: string }[]).map((r) => r.id));
    if (!data || data.length < page) break;
  }
  return ids;
}

export async function forEachIdChunk(ids: string[], size: number, fn: (part: string[]) => Promise<void>) {
  for (const part of chunk(ids, size)) await fn(part);
}
