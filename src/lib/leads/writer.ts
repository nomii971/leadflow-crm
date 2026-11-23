import type { SupabaseClient } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/utils";
import {
  buildUpdatePatch,
  decide,
  findMatch,
  keysFor,
  type DuplicateStrategy,
  type ExistingLeadKey,
  type MatchType,
} from "./dedupe";
import type { LeadInput } from "./validate";

export interface IncomingRecord {
  index: number; // row number in file / position in page
  lead: LeadInput;
  raw: Record<string, unknown>;
}

export type RecordOutcome =
  | { index: number; outcome: "inserted"; leadId: string }
  | { index: number; outcome: "updated"; leadId: string; matchType: MatchType }
  | { index: number; outcome: "skipped"; leadId: string | null; matchType: MatchType | "in_file"; message: string }
  | { index: number; outcome: "review"; leadId: string; matchType: MatchType; reviewId?: string }
  | { index: number; outcome: "failed"; message: string };

export interface WriteContext {
  strategy: DuplicateStrategy;
  origin: "csv_import" | "collector" | "api" | "manual";
  sourceType: "import" | "collection";
  importJobId?: string;
  collectionJobId?: string;
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const uniq = (a: (string | null)[]) => Array.from(new Set(a.filter((x): x is string => !!x)));

/**
 * Writes a batch of validated leads with duplicate detection against the database AND within the batch.
 * Never merges uncertain (name + company) matches: those are queued in duplicate_reviews.
 */
export async function writeLeads(
  supabase: SupabaseClient,
  records: IncomingRecord[],
  ctx: WriteContext,
): Promise<RecordOutcome[]> {
  if (records.length === 0) return [];
  const keyed = records.map((r) => ({ ...r, keys: keysFor(r.lead) }));

  const { data: existingRows, error: dupErr } = await supabase.rpc("find_duplicate_candidates", {
    p_linkedin: uniq(keyed.map((k) => k.keys.linkedin)),
    p_emails: uniq(keyed.map((k) => k.keys.email)),
    p_name_company: uniq(keyed.map((k) => k.keys.nameCompany)),
  });
  if (dupErr) throw new Error(`Duplicate lookup failed: ${dupErr.message}`);
  const existing: ExistingLeadKey[] = (existingRows ?? []) as ExistingLeadKey[];

  const outcomes = new Map<number, RecordOutcome>();
  const toInsert: typeof keyed = [];
  const toUpdate: { rec: (typeof keyed)[number]; leadId: string; matchType: MatchType }[] = [];
  const toReview: { rec: (typeof keyed)[number]; leadId: string; matchType: MatchType }[] = [];
  const reviewAgainstBatch: { rec: (typeof keyed)[number]; batchIndex: number; matchType: MatchType }[] = [];
  const batchSeen: ExistingLeadKey[] = [];

  for (const rec of keyed) {
    const dbMatch = findMatch(rec.keys, existing);
    if (dbMatch) {
      const d = decide(dbMatch, ctx.strategy);
      if (d.action === "insert") toInsert.push(rec);
      else if (d.action === "update") toUpdate.push({ rec, leadId: d.leadId, matchType: d.matchType });
      else if (d.action === "review") toReview.push({ rec, leadId: d.leadId, matchType: d.matchType });
      else
        outcomes.set(rec.index, {
          index: rec.index,
          outcome: "skipped",
          leadId: d.leadId,
          matchType: d.matchType,
          message: `Duplicate of existing lead (${d.matchType.replace("_", " ")})`,
        });
      continue;
    }
    const batchMatch = ctx.strategy === "keep_both" ? null : findMatch(rec.keys, batchSeen);
    if (batchMatch) {
      const firstIndex = Number(batchMatch.lead.id.slice("batch:".length));
      if (batchMatch.type === "name_company") {
        reviewAgainstBatch.push({ rec, batchIndex: firstIndex, matchType: batchMatch.type });
      } else {
        outcomes.set(rec.index, {
          index: rec.index,
          outcome: "skipped",
          leadId: null,
          matchType: "in_file",
          message: `Duplicate of row ${firstIndex} in the same batch (${batchMatch.type.replace("_", " ")})`,
        });
      }
      continue;
    }
    toInsert.push(rec);
    batchSeen.push({
      id: `batch:${rec.index}`,
      linkedin_url_norm: rec.keys.linkedin,
      email_norm: rec.keys.email,
      name_company_key: rec.keys.nameCompany,
    });
  }

  const insertRow = (r: (typeof keyed)[number]) => ({
    ...r.lead,
    origin: ctx.origin,
    import_job_id: ctx.importJobId ?? null,
    collection_job_id: ctx.collectionJobId ?? null,
    collected_at: r.lead.collected_at ?? new Date().toISOString(),
  });

  // Bulk insert; on failure fall back to row-by-row so one bad record cannot sink the batch.
  const insertedIds = new Map<number, string>();
  if (toInsert.length) {
    const { data, error } = await supabase.from("leads").insert(toInsert.map(insertRow)).select("id");
    if (!error && data && data.length === toInsert.length) {
      data.forEach((row, i) => insertedIds.set(toInsert[i].index, row.id as string));
    } else {
      await pool(toInsert, 8, async (r) => {
        const { data: one, error: e1 } = await supabase.from("leads").insert(insertRow(r)).select("id").single();
        if (e1 || !one) outcomes.set(r.index, { index: r.index, outcome: "failed", message: e1?.message ?? "Insert failed" });
        else insertedIds.set(r.index, one.id as string);
      });
    }
    for (const [index, leadId] of insertedIds) outcomes.set(index, { index, outcome: "inserted", leadId });
  }

  await pool(toUpdate, 8, async ({ rec, leadId, matchType }) => {
    const patch = buildUpdatePatch(rec.lead);
    const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
    outcomes.set(
      rec.index,
      error ? { index: rec.index, outcome: "failed", message: error.message } : { index: rec.index, outcome: "updated", leadId, matchType },
    );
  });

  for (const r of reviewAgainstBatch) {
    const leadId = insertedIds.get(r.batchIndex);
    if (leadId) toReview.push({ rec: r.rec, leadId, matchType: r.matchType });
    else outcomes.set(r.rec.index, { index: r.rec.index, outcome: "failed", message: "Matched a row that failed to insert" });
  }

  if (toReview.length) {
    try {
      const { data, error } = await supabase
        .from("duplicate_reviews")
        .insert(
          toReview.map(({ rec, leadId, matchType }) => ({
            source_type: ctx.sourceType,
            import_job_id: ctx.importJobId ?? null,
            collection_job_id: ctx.collectionJobId ?? null,
            matched_lead_id: leadId,
            match_type: matchType,
            incoming: rec.lead,
          })),
        )
        .select("id");
      if (error) throw error;
      toReview.forEach(({ rec, leadId, matchType }, i) =>
        outcomes.set(rec.index, { index: rec.index, outcome: "review", leadId, matchType, reviewId: data?.[i]?.id as string }),
      );
    } catch (e) {
      toReview.forEach(({ rec }) => outcomes.set(rec.index, { index: rec.index, outcome: "failed", message: errorMessage(e) }));
    }
  }

  return records.map(
    (r) => outcomes.get(r.index) ?? { index: r.index, outcome: "failed", message: "Record was not processed" },
  );
}
