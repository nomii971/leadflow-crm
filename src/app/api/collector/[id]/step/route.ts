import { z } from "zod";
import { json, route } from "@/lib/api";
import { getAdapter } from "@/lib/collector/registry";
import { executeStep, type JobSnapshot } from "@/lib/collector/engine";
import { writeLeads } from "@/lib/leads/writer";

export const maxDuration = 60; // Vercel Hobby allows up to 60s per function call

const schema = z.object({ step_seq: z.number().int().min(0), payload: z.unknown().optional() });

/** Processes exactly one page of a running collection job. Safe to call repeatedly; guarded by step_seq. */
export const POST = route<{ id: string }>(async (req, { supabase }, { id }) => {
  z.string().uuid().parse(id);
  const { step_seq, payload } = schema.parse(await req.json());
  const { data: job } = await supabase.from("collection_jobs").select("*").eq("id", id).single();
  if (!job) return json({ error: "Not found" }, 404);
  if (job.step_seq !== step_seq) return json({ error: "Stale step", job }, 409);
  if (job.status !== "running") return json({ job, done: true });
  const adapter = getAdapter(job.source_adapter);
  if (!adapter) return json({ error: "Unknown source adapter" }, 409);

  // Claim the step first so a second tab cannot process the same page.
  const { data: claimed } = await supabase
    .from("collection_jobs").update({ step_seq: step_seq + 1, last_heartbeat_at: new Date().toISOString() })
    .eq("id", id).eq("step_seq", step_seq).select("id");
  if (!claimed?.length) return json({ error: "Another session is processing this job" }, 409);

  const out = await executeStep(job as JobSnapshot, {
    adapter,
    payload,
    leadSource: adapter.id === "file_upload" ? job.config?.file?.name ? `File: ${job.config.file.name}` : undefined : adapter.name,
    writeRecords: (records) =>
      writeLeads(supabase, records, { strategy: job.duplicate_strategy, origin: "collector", sourceType: "collection", collectionJobId: id }),
  });

  if (out.results.length) {
    const { error } = await supabase.from("collection_job_results").insert(out.results.map((r) => ({ ...r, job_id: id })));
    if (error) console.error("collection_job_results insert failed", error.message);
  }

  // Respect a pause/cancel that arrived while this page was processing.
  const { data: current } = await supabase.from("collection_jobs").select("status").eq("id", id).single();
  const patch = { ...out.patch, last_heartbeat_at: new Date().toISOString() };
  if (current && current.status !== "running" && patch.status === "running") patch.status = current.status;
  const { data: updated, error } = await supabase.from("collection_jobs").update(patch).eq("id", id).select("*").single();
  if (error) return json({ error: error.message }, 500);
  return json({ job: updated, done: updated.status !== "running" });
}, { limit: 120, name: "collector-step" });
