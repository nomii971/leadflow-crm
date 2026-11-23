import { z } from "zod";
import { json, route } from "@/lib/api";
import { IMPORTABLE_FIELDS } from "@/lib/leads/fields";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/constants";

const fieldKeys = IMPORTABLE_FIELDS.map((f) => f.key) as [string, ...string[]];
const schema = z.object({
  file_name: z.string().trim().min(1).max(255),
  file_size: z.number().int().min(0).max(MAX_IMPORT_FILE_BYTES),
  total_rows: z.number().int().min(0).max(2_000_000),
  strategy: z.enum(["new_only", "update_existing", "skip_duplicates", "review_duplicates"]),
  lead_source: z.string().trim().max(200).optional().nullable(),
  column_mapping: z.record(z.string().max(300), z.union([z.enum(fieldKeys), z.literal("")])),
});

export const POST = route(async (req, { supabase }) => {
  const body = schema.parse(await req.json());
  const mapped = Object.values(body.column_mapping).filter(Boolean);
  if (!mapped.some((k) => ["full_name", "first_name", "last_name"].includes(k))) {
    return json({ error: "Map at least one name column (Full Name or First/Last Name)." }, 400);
  }
  const { data, error } = await supabase.from("import_jobs").insert({ ...body, status: "pending" }).select("id").single();
  if (error) return json({ error: error.message }, 500);
  return json({ id: data.id });
}, { limit: 30 });
