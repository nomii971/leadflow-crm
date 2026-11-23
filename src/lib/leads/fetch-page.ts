import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyLeadFilters, leadSelect, parseLeadFilters, SORTABLE } from "./query";
import type { Lead } from "@/lib/types";

/** Server-side paginated lead query driven by URL search params. Never loads the full table. */
export async function fetchLeadPage(supabase: SupabaseClient, sp: Record<string, string | string[] | undefined>, forced: Record<string, string> = {}) {
  const filters = { ...parseLeadFilters(sp), ...parseLeadFilters(forced) };
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const page = Math.max(1, Number(one("page")) || 1);
  const pageSize = [25, 50, 100, 200].includes(Number(one("per"))) ? Number(one("per")) : 50;
  const sortParam = one("sort") ?? "created_at";
  const sort = (SORTABLE as readonly string[]).includes(sortParam) ? sortParam : "created_at";
  const dir: "asc" | "desc" = one("dir") === "asc" ? "asc" : "desc";

  const from = (page - 1) * pageSize;
  const q = applyLeadFilters(supabase.from("leads").select(leadSelect("*", filters), { count: "exact" }), filters)
    .order(sort, { ascending: dir === "asc", nullsFirst: false })
    .order("id")
    .range(from, from + pageSize - 1);
  const { data, count, error } = await q;
  return { leads: (data ?? []) as unknown as Lead[], total: count ?? 0, page, pageSize, sort, dir, filters, error: error?.message };
}
