import { z } from "zod";
import { json, route } from "@/lib/api";
import { mapAndValidateRow } from "@/lib/leads/validate";
import { writeLeads, type IncomingRecord } from "@/lib/leads/writer";
import type { LeadFieldKey } from "@/lib/leads/fields";
import { IMPORT_BATCH_SIZE } from "@/lib/constants";

const schema = z.object({
  startRow: z.number().int().min(1),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(IMPORT_BATCH_SIZE),
});

export const maxDuration = 60;

export const POST = route<{ id: string }>(async (req, { supabase }, { id }) => {
  z.string().uuid().parse(id);
  const { startRow, rows } = schema.parse(await req.json());
  const { data: job, error: jobErr } = await supabase
    .from("import_jobs").select("id,status,strategy,column_mapping,lead_source,next_row").eq("id", id).single();
  if (jobErr || !job) return json({ error: "Import job not found" }, 404);
  if (!["pending", "processing"].includes(job.status)) return json({ error: `Import is ${job.status}` }, 409);
  if (job.next_row !== startRow) return json({ error: "Batch out of order", next_row: job.next_row }, 409);

  const mapping = job.column_mapping as Record<string, LeadFieldKey | "">;
  const valid: IncomingRecord[] = [];
  const errors: { row_number: number; error_type: string; message: string; raw_data: Record<string, unknown> }[] = [];
  // Spreadsheet row number = data row + 1 (header line)
  rows.forEach((raw, i) => {
    const rowNumber = startRow + i + 1;
    const r = mapAndValidateRow(raw, mapping, { lead_source: job.lead_source });
    if (r.ok) valid.push({ index: rowNumber, lead: r.lead, raw });
    else errors.push({ row_number: rowNumber, error_type: "validation", message: r.errors.join("; "), raw_data: raw });
  });

  const outcomes = await writeLeads(supabase, valid, {
    strategy: job.strategy as "skip_duplicates",
    origin: "csv_import",
    sourceType: "import",
    importJobId: id,
  });

  const rawByRow = new Map(valid.map((v) => [v.index, v.raw]));
  let inserted = 0, updated = 0, duplicates = 0, review = 0, failed = errors.length;
  for (const o of outcomes) {
    if (o.outcome === "inserted") inserted++;
    else if (o.outcome === "updated") updated++;
    else if (o.outcome === "skipped") {
      duplicates++;
      errors.push({ row_number: o.index, error_type: "skipped_duplicate", message: o.message, raw_data: rawByRow.get(o.index) ?? {} });
    } else if (o.outcome === "review") {
      review++;
      errors.push({ row_number: o.index, error_type: "duplicate_review", message: `Possible duplicate (${o.matchType.replace("_", " + ")}) queued for review`, raw_data: rawByRow.get(o.index) ?? {} });
    } else {
      failed++;
      errors.push({ row_number: o.index, error_type: "database", message: o.message, raw_data: rawByRow.get(o.index) ?? {} });
    }
  }
  if (errors.length) {
    const { error } = await supabase.from("import_errors").insert(errors.map((e) => ({ ...e, import_job_id: id })));
    if (error) console.error("import_errors insert failed", error.message);
  }
  const { data: applied, error: recErr } = await supabase.rpc("record_import_batch", {
    p_job: id, p_start: startRow, p_rows: rows.length, p_inserted: inserted, p_updated: updated,
    p_duplicates: duplicates, p_skipped: 0, p_review: review, p_failed: failed,
  });
  if (recErr) return json({ error: recErr.message }, 500);
  if (!applied) return json({ error: "Batch was already recorded" }, 409);
  return json({ inserted, updated, duplicates, review, failed, next_row: startRow + rows.length });
}, { limit: 120, name: "import-batch" });
