import { z } from "zod";
import { json, route } from "@/lib/api";
import { getAdapter } from "@/lib/collector/registry";

const schema = z.object({ action: z.enum(["start", "pause", "cancel", "extend"]), max_records: z.number().int().min(1).max(100000).optional() });
const RESUMABLE = ["queued", "paused", "failed", "interrupted", "running", "limit_reached"];

export const POST = route<{ id: string }>(async (req, { supabase }, { id }) => {
  z.string().uuid().parse(id);
  const { action, max_records } = schema.parse(await req.json());
  const { data: job } = await supabase.from("collection_jobs").select("*").eq("id", id).single();
  if (!job) return json({ error: "Not found" }, 404);
  const now = new Date().toISOString();
  let patch: Record<string, unknown>;

  if (action === "start") {
    if (!RESUMABLE.includes(job.status)) return json({ error: `A ${job.status} job cannot be resumed.` }, 409);
    if (job.status === "limit_reached" && job.retrieved_count >= job.max_records) return json({ error: "Raise the record limit first." }, 409);
    const adapter = getAdapter(job.source_adapter);
    if (!adapter) return json({ error: "Source adapter no longer exists" }, 409);
    if (job.pages_fetched > 0 && !adapter.capabilities.pauseResume) return json({ error: "This source does not support resuming." }, 409);
    patch = { status: "running", status_reason: null, last_error: null, started_at: job.started_at ?? now, finished_at: null, last_heartbeat_at: now };
  } else if (action === "pause") {
    if (job.status !== "running") return json({ error: "Job is not running" }, 409);
    patch = { status: "paused", status_reason: "Paused by you." };
  } else if (action === "cancel") {
    if (["complete", "partial", "limit_reached", "interrupted", "failed"].includes(job.status)) return json({ error: "Job already finished" }, 409);
    patch = { status: "interrupted", status_reason: "Cancelled by you. Records saved so far are kept.", finished_at: now };
  } else {
    if (!max_records || max_records <= job.retrieved_count) return json({ error: "New limit must be above records already retrieved." }, 400);
    patch = { max_records, ...(job.status === "limit_reached" ? { status: "paused", status_reason: "Limit raised. Resume to continue." } : {}) };
  }
  const { data, error } = await supabase.from("collection_jobs").update(patch).eq("id", id).select("*").single();
  if (error) return json({ error: error.message }, 500);
  return json(data);
}, { limit: 60 });
