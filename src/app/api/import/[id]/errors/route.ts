import Papa from "papaparse";
import { z } from "zod";
import { route } from "@/lib/api";
import { escapeFormula } from "@/lib/csv/sanitize";

/** Downloads failed / skipped / review rows with their original columns plus the reason, ready to fix and re-import. */
export const GET = route<{ id: string }>(async (req, { supabase }, { id }) => {
  z.string().uuid().parse(id);
  const type = new URL(req.url).searchParams.get("type");
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    let q = supabase.from("import_errors").select("row_number,error_type,message,raw_data").eq("import_job_id", id).order("row_number").range(from, from + 999);
    if (type) q = q.eq("error_type", type);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const e of data ?? []) {
      const raw = (e.raw_data ?? {}) as Record<string, unknown>;
      rows.push({ "Row number": e.row_number, "Issue type": e.error_type, Reason: e.message, ...Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, escapeFormula(v)])) });
    }
    if (!data || data.length < 1000) break;
  }
  const csv = Papa.unparse(rows.length ? rows : [{ "Row number": "", "Issue type": "", Reason: "No issues" }]);
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="import-${id.slice(0, 8)}-issues.csv"` },
  });
});
