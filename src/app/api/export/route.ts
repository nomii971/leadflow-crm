import { z } from "zod";
import { json, route } from "@/lib/api";
import { bulkTargetSchema } from "@/lib/leads/query";
import { EXPORT_DEFAULT_COLUMNS, LEAD_FIELDS, type LeadFieldKey } from "@/lib/leads/fields";
import { fetchLeadsForExport, toCsv, toXlsx } from "@/lib/export";

export const maxDuration = 60;

const keys = LEAD_FIELDS.map((f) => f.key) as [LeadFieldKey, ...LeadFieldKey[]];
const schema = z.object({
  target: bulkTargetSchema,
  format: z.enum(["csv", "xlsx"]),
  columns: z.array(z.enum(keys)).min(1).max(keys.length).optional(),
  name: z.string().max(80).optional(),
});

export const POST = route(async (req, { supabase }) => {
  const body = schema.parse(await req.json());
  const columns = body.columns ?? EXPORT_DEFAULT_COLUMNS;
  const rows = await fetchLeadsForExport(supabase, body.target, columns);
  if (rows.length === 0) return json({ error: "No leads match this export." }, 404);
  const base = (body.name ?? "leadflow-leads").replace(/[^\w.-]+/g, "-").slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  if (body.format === "csv") {
    return new Response(toCsv(rows, columns), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}-${stamp}.csv"`, "X-Row-Count": String(rows.length) },
    });
  }
  const buf = toXlsx(rows, columns);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}-${stamp}.xlsx"`,
      "X-Row-Count": String(rows.length),
    },
  });
}, { limit: 20, name: "export" });
