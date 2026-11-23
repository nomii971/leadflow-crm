"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { buildUpdatePatch } from "@/lib/leads/dedupe";
import { validateLeadFields } from "@/lib/leads/validate";
import { errorMessage } from "@/lib/utils";

/** Applies the user's decision. Merging only ever happens here, on an explicit choice. */
export async function resolveDuplicate(id: string, action: "skip" | "update" | "keep_both") {
  try {
    const { supabase } = await requireUser();
    z.string().uuid().parse(id);
    z.enum(["skip", "update", "keep_both"]).parse(action);
    const { data: r } = await supabase.from("duplicate_reviews").select("*").eq("id", id).eq("status", "pending").single();
    if (!r) return { ok: false as const, error: "Already resolved" };
    const v = validateLeadFields(r.incoming as Record<string, unknown>);
    if (!v.ok) return { ok: false as const, error: v.errors.join("; ") };

    if (action === "update" && r.matched_lead_id) {
      const { error } = await supabase.from("leads").update(buildUpdatePatch(v.lead)).eq("id", r.matched_lead_id);
      if (error) return { ok: false as const, error: error.message };
    } else if (action === "keep_both") {
      const { error } = await supabase.from("leads").insert({
        ...v.lead,
        origin: r.source_type === "collection" ? "collector" : "csv_import",
        import_job_id: r.import_job_id, collection_job_id: r.collection_job_id,
        collected_at: v.lead.collected_at ?? r.created_at,
      });
      if (error) return { ok: false as const, error: error.message };
    }
    const status = action === "skip" ? "skipped" : action === "update" ? "updated" : "kept_both";
    await supabase.from("duplicate_reviews").update({ status, resolved_at: new Date().toISOString() }).eq("id", id);
    revalidatePath("/imports/duplicates");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

export async function resolveAllSkip() {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("duplicate_reviews").update({ status: "skipped", resolved_at: new Date().toISOString() }).eq("status", "pending");
    if (error) return { ok: false as const, error: error.message };
    revalidatePath("/imports/duplicates");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}
