"use server";
import { requireUser } from "@/lib/supabase/server";
import { applyLeadFilters, leadFiltersSchema, leadSelect, type LeadFilters } from "@/lib/leads/query";

export async function countLeads(filters: LeadFilters) {
  const { supabase } = await requireUser();
  const f = leadFiltersSchema.parse(filters);
  const { count, error } = await applyLeadFilters(supabase.from("leads").select(leadSelect("id", f), { count: "exact", head: true }), f);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, count: count ?? 0 };
}
