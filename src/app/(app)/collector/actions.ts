"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getAdapter } from "@/lib/collector/registry";
import { createJobSchema, filtersSchema, locationSchema, type CreateJobInput } from "@/lib/collector/schema";
import { errorMessage } from "@/lib/utils";

export async function createCollectionJob(input: CreateJobInput) {
  try {
    const { supabase } = await requireUser();
    const v = createJobSchema.parse(input);
    const adapter = getAdapter(v.source_adapter);
    if (!adapter) return { ok: false as const, error: "Unknown source" };
    const status = await adapter.status();
    if (status.state === "unavailable" || status.state === "not_configured" || status.state === "error") {
      return { ok: false as const, error: `${adapter.name}: ${status.label}. ${status.detail}` };
    }
    if (adapter.kind === "file" && !v.file) return { ok: false as const, error: "Select the export file to process." };
    const { data, error } = await supabase
      .from("collection_jobs")
      .insert({
        name: v.name,
        source_adapter: v.source_adapter,
        config: { locations: v.locations, filters: v.filters, ...(v.file ? { file: v.file } : {}) },
        max_records: v.max_records,
        page_size: Math.min(v.page_size, adapter.capabilities.maxPageSize),
        duplicate_strategy: v.duplicate_strategy,
        status: "queued",
        total_reported: v.file?.rows ?? null,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    revalidatePath("/collector");
    return { ok: true as const, id: data.id as string };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

export async function deleteCollectionJob(id: string) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("collection_jobs").delete().eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false as const, error: error.message };
    revalidatePath("/collector");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

const savedSchema = z.object({ name: z.string().trim().min(1).max(120), locations: z.array(locationSchema).max(200), filters: filtersSchema });

export async function saveSearch(input: z.infer<typeof savedSchema>) {
  try {
    const { supabase } = await requireUser();
    const v = savedSchema.parse(input);
    const { data, error } = await supabase.from("saved_searches").insert(v).select("id,name,locations,filters").single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, search: data };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

export async function deleteSavedSearch(id: string) {
  try {
    const { supabase } = await requireUser();
    await supabase.from("saved_searches").delete().eq("id", z.string().uuid().parse(id));
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}
