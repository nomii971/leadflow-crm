import { z } from "zod";
import { json, route } from "@/lib/api";

const schema = z.object({ cancelled: z.boolean().optional(), error: z.string().max(1000).optional() });

export const POST = route<{ id: string }>(async (req, { supabase }, { id }) => {
  z.string().uuid().parse(id);
  const body = schema.parse(await req.json().catch(() => ({})));
  const { data: job } = await supabase.from("import_jobs").select("*").eq("id", id).single();
  if (!job) return json({ error: "Not found" }, 404);
  const status = body.error ? "failed" : body.cancelled ? "cancelled" : job.failed_count > 0 || job.review_count > 0 ? "completed_with_errors" : "completed";
  const { data, error } = await supabase
    .from("import_jobs")
    .update({ status, finished_at: new Date().toISOString(), error_message: body.error ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return json({ error: error.message }, 500);
  return json(data);
});
