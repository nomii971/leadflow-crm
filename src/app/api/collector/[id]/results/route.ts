import Papa from "papaparse";
import { z } from "zod";
import { route } from "@/lib/api";
import { escapeFormula } from "@/lib/csv/sanitize";

/** Per-record outcomes of a collection job (failed, duplicates, review, saved) as CSV. */
export const GET = route<{ id: string }>(async (req, { supabase }, { id }) => {
  z.string().uuid().parse(id);
  const outcome = new URL(req.url).searchParams.get("outcome");
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    let q = supabase.from("collection_job_results").select("page_number,outcome,lead_id,source_record_id,error_message,raw_data,created_at").eq("job_id", id).order("created_at").range(from, from + 999);
    if (outcome) q = q.eq("outcome", outcome);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const raw = (r.raw_data ?? {}) as Record<string, unknown>;
      rows.push({
        Outcome: r.outcome, Reason: r.error_message ?? "", Page: r.page_number, "Source record": r.source_record_id ?? "", "Lead ID": r.lead_id ?? "",
        ...Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v !== "object").map(([k, v]) => [k, escapeFormula(v)])),
      });
    }
    if (!data || data.length < 1000) break;
  }
  const csv = Papa.unparse(rows.length ? rows : [{ Outcome: "", Reason: "No records" }]);
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="collection-${id.slice(0, 8)}-${outcome ?? "all"}.csv"` },
  });
});
