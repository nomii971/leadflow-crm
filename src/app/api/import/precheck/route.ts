import { z } from "zod";
import { json, route } from "@/lib/api";
import { findMatch, type ExistingLeadKey } from "@/lib/leads/dedupe";

const schema = z.object({
  keys: z.array(z.object({ linkedin: z.string().max(600).nullable(), email: z.string().max(320).nullable(), nameCompany: z.string().max(700).nullable() })).max(1000),
});

/** Duplicate pre-check for the import preview: which incoming rows already exist in the CRM, and how. */
export const POST = route(async (req, { supabase }) => {
  const { keys } = schema.parse(await req.json());
  const u = (a: (string | null)[]) => Array.from(new Set(a.filter((x): x is string => !!x)));
  const { data, error } = await supabase.rpc("find_duplicate_candidates", {
    p_linkedin: u(keys.map((k) => k.linkedin)),
    p_emails: u(keys.map((k) => k.email)),
    p_name_company: u(keys.map((k) => k.nameCompany)),
  });
  if (error) return json({ error: error.message }, 500);
  const existing = (data ?? []) as ExistingLeadKey[];
  return json({ matches: keys.map((k) => findMatch(k, existing)?.type ?? null) });
}, { limit: 240, name: "import-precheck" });
