import { z } from "zod";
import { json, route } from "@/lib/api";
import { applyLeadFilters, leadFiltersSchema, leadSelect } from "@/lib/leads/query";
import { EXPORT_ROW_CAP } from "@/lib/export";
import { chunk } from "@/lib/utils";

export const maxDuration = 60;

const schema = z.object({
  filters: leadFiltersSchema,
  exportedAt: z.string().datetime({ offset: true }),
  exportedCount: z.number().int().min(1).max(EXPORT_ROW_CAP - 1),
});

/**
 * "Export & delete": removes the leads of an export that the browser has already saved.
 * Only leads that match the same filters AND were neither created nor changed after the export read its rows
 * (and, for a list export, were already in the list) are deleted, so nothing that was missing from the file is
 * removed. Activities, notes, tasks, list memberships and duplicate reviews go with them (ON DELETE CASCADE);
 * company records left with no leads are removed too.
 */
export const POST = route(async (req, { supabase }) => {
  const body = schema.parse(await req.json());
  const f = body.filters;
  const at = new Date(body.exportedAt).toISOString();

  const ids: string[] = [];
  const companyIds = new Set<string>();
  for (let from = 0; ; from += 1000) {
    let q = applyLeadFilters(supabase.from("leads").select(leadSelect("id, company_id", f)), f)
      .lte("created_at", at)
      .lte("updated_at", at);
    if (f.list_id) q = q.lte("lead_list_members.added_at", at);
    const { data, error } = await q.order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as { id: string; company_id: string | null }[];
    for (const r of rows) { ids.push(r.id); if (r.company_id) companyIds.add(r.company_id); }
    if (rows.length < 1000) break;
    if (ids.length > body.exportedCount) break;
  }
  // The set can only shrink after an export; more rows than were exported means something is off, so stop.
  if (ids.length > body.exportedCount) {
    return json({ error: "The leads changed since this export, so nothing was deleted. Export again, then delete." }, 409);
  }

  let deleted = 0;
  for (const part of chunk(ids, 200)) {
    const { error, count } = await supabase.from("leads").delete({ count: "exact" }).in("id", part);
    if (error) throw new Error(`Deleted ${deleted} leads, then failed: ${error.message}`);
    deleted += count ?? part.length;
  }

  let companiesRemoved = 0;
  for (const part of chunk(Array.from(companyIds), 200)) {
    const { data, error } = await supabase.from("companies_with_counts").select("id").in("id", part).eq("lead_count", 0);
    if (error) break; // leftover company rows are harmless; don't fail the whole request for them
    const empty = (data ?? []).map((c) => c.id as string);
    if (!empty.length) continue;
    const { error: delError, count } = await supabase.from("companies").delete({ count: "exact" }).in("id", empty);
    if (!delError) companiesRemoved += count ?? empty.length;
  }

  return json({ deleted, kept: body.exportedCount - deleted, companiesRemoved });
}, { limit: 10, name: "export-delete" });
