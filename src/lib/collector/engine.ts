// Bulk collection engine: processes ONE page per step so it fits serverless time limits.
// The browser (or any caller) drives steps until the job leaves the "running" state.
// Pure logic with injected dependencies, so it is unit-tested without a database.

import type { CollectorDuplicateStrategy } from "@/lib/constants";
import { validateLeadFields } from "@/lib/leads/validate";
import type { IncomingRecord, RecordOutcome } from "@/lib/leads/writer";
import { errorMessage, sleep as realSleep } from "@/lib/utils";
import { matchesConfig } from "./filters";
import {
  RetryableSourceError,
  SourceConfigError,
  SourceRestrictionError,
  type CollectorConfig,
  type FetchPageResult,
  type SourceAdapter,
} from "./types";

export type JobStatus = "queued" | "running" | "paused" | "complete" | "partial" | "limit_reached" | "interrupted" | "failed";

export interface JobSnapshot {
  id: string;
  status: JobStatus;
  config: CollectorConfig;
  max_records: number;
  page_size: number;
  duplicate_strategy: CollectorDuplicateStrategy;
  total_reported: number | null;
  retrieved_count: number;
  saved_count: number;
  updated_count: number;
  duplicate_count: number;
  review_count: number;
  filtered_count: number;
  failed_count: number;
  pages_fetched: number;
  cursor: unknown | null;
  retry_count: number;
}

export interface ResultRow {
  page_number: number;
  outcome: "saved" | "updated" | "duplicate" | "review" | "failed";
  lead_id: string | null;
  source_record_id: string | null;
  raw_data: Record<string, unknown>;
  error_message: string | null;
}

export interface StepDeps {
  adapter: SourceAdapter;
  writeRecords: (records: IncomingRecord[]) => Promise<RecordOutcome[]>;
  payload?: unknown;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  leadSource?: string;
}

export type JobPatch = Partial<Omit<JobSnapshot, "id" | "config">> & {
  status: JobStatus;
  status_reason?: string | null;
  last_error?: string | null;
  finished_at?: string | null;
};

export interface StepOutput {
  patch: JobPatch;
  results: ResultRow[];
  done: boolean;
}

const TERMINAL: JobStatus[] = ["complete", "partial", "limit_reached", "interrupted", "failed"];
export const isTerminal = (s: string) => (TERMINAL as string[]).includes(s);

async function fetchWithRetry(deps: StepDeps, job: JobSnapshot, pageSize: number) {
  const max = deps.maxAttempts ?? 4;
  const wait = deps.sleep ?? realSleep;
  let attempt = 0;
  let retries = 0;
  for (;;) {
    attempt++;
    try {
      const res = await deps.adapter.fetchPage({ config: job.config, cursor: job.cursor, pageSize, payload: deps.payload });
      return { res, retries };
    } catch (e) {
      if (e instanceof RetryableSourceError && attempt < max) {
        retries++;
        const backoff = Math.min(e.retryAfterMs ?? 1000 * 2 ** (attempt - 1), 15000);
        await wait(backoff);
        continue;
      }
      throw e;
    }
  }
}

export async function executeStep(job: JobSnapshot, deps: StepDeps): Promise<StepOutput> {
  const finish = (status: JobStatus, reason: string | null, extra: Partial<JobPatch> = {}): StepOutput => ({
    patch: { status, status_reason: reason, finished_at: new Date().toISOString(), ...extra },
    results: [],
    done: true,
  });

  if (job.status !== "running") return { patch: { status: job.status }, results: [], done: isTerminal(job.status) };

  const remaining = job.max_records - job.retrieved_count;
  if (remaining <= 0) return finish("limit_reached", `Configured maximum of ${job.max_records} records reached.`);

  const pageSize = Math.max(1, Math.min(job.page_size, remaining, deps.adapter.capabilities.maxPageSize));
  let res: FetchPageResult;
  let retries = 0;
  try {
    ({ res, retries } = await fetchWithRetry(deps, job, pageSize));
  } catch (e) {
    if (e instanceof SourceRestrictionError) return finish("partial", e.message);
    const kind = e instanceof SourceConfigError ? "Configuration error" : e instanceof RetryableSourceError ? "Source unavailable after retries" : "Error";
    return finish("failed", `${kind}: ${errorMessage(e)}`, { last_error: errorMessage(e) });
  }

  const pageNumber = job.pages_fetched + 1;
  // Never retrieve past the configured limit, even if the source returned a larger page.
  const records = res.records.slice(0, remaining);
  const truncated = res.records.length > records.length;

  const results: ResultRow[] = [];
  const toWrite: IncomingRecord[] = [];
  const sourceIds = new Map<number, string | null>();
  let filtered = 0;
  let failed = 0;

  records.forEach((rec, i) => {
    const index = job.retrieved_count + i + 1;
    if (!matchesConfig(rec.data, job.config)) {
      filtered++;
      return;
    }
    const v = validateLeadFields(rec.data as Record<string, unknown>, { lead_source: deps.leadSource ?? deps.adapter.name });
    if (!v.ok) {
      failed++;
      results.push({
        page_number: pageNumber,
        outcome: "failed",
        lead_id: null,
        source_record_id: rec.sourceId ?? null,
        raw_data: rec.raw,
        error_message: v.errors.join("; "),
      });
      return;
    }
    sourceIds.set(index, rec.sourceId ?? null);
    toWrite.push({ index, lead: { ...v.lead, source_reference: v.lead.source_reference ?? rec.sourceId ?? null }, raw: rec.raw });
  });

  let saved = 0, updated = 0, dup = 0, review = 0;
  let outcomes: RecordOutcome[] = [];
  try {
    outcomes = await deps.writeRecords(toWrite);
  } catch (e) {
    // Database problem: do not advance the cursor, so a resume re-fetches this page.
    return finish("failed", `Saving page ${pageNumber} failed: ${errorMessage(e)}`, { last_error: errorMessage(e) });
  }
  const byIndex = new Map(toWrite.map((r) => [r.index, r]));
  for (const o of outcomes) {
    const rec = byIndex.get(o.index);
    const base = { page_number: pageNumber, source_record_id: sourceIds.get(o.index) ?? null, raw_data: (rec?.lead ?? {}) as Record<string, unknown> };
    if (o.outcome === "inserted") { saved++; results.push({ ...base, outcome: "saved", lead_id: o.leadId, error_message: null }); }
    else if (o.outcome === "updated") { updated++; results.push({ ...base, outcome: "updated", lead_id: o.leadId, error_message: null }); }
    else if (o.outcome === "skipped") { dup++; results.push({ ...base, outcome: "duplicate", lead_id: o.leadId, error_message: o.message }); }
    else if (o.outcome === "review") { review++; results.push({ ...base, outcome: "review", lead_id: o.leadId, error_message: `Possible duplicate (${o.matchType})` }); }
    else { failed++; results.push({ ...base, outcome: "failed", lead_id: null, error_message: o.message }); }
  }

  const retrieved = job.retrieved_count + records.length;
  const counts = {
    retrieved_count: retrieved,
    saved_count: job.saved_count + saved,
    updated_count: job.updated_count + updated,
    duplicate_count: job.duplicate_count + dup,
    review_count: job.review_count + review,
    filtered_count: job.filtered_count + filtered,
    failed_count: job.failed_count + failed,
    pages_fetched: pageNumber,
    cursor: res.nextCursor,
    total_reported: res.totalReported ?? job.total_reported,
    retry_count: job.retry_count + retries,
    last_error: null,
  };

  if (res.nextCursor === null && !truncated) {
    return { patch: { ...counts, status: "complete", status_reason: "The source reported no more results.", finished_at: new Date().toISOString() }, results, done: true };
  }
  if (retrieved >= job.max_records) {
    return {
      patch: { ...counts, status: "limit_reached", status_reason: `Configured maximum of ${job.max_records} records reached; more results may exist.`, finished_at: new Date().toISOString() },
      results,
      done: true,
    };
  }
  if (records.length === 0 && res.nextCursor !== null) {
    // A source returning empty pages with a cursor would loop forever; treat as a restriction.
    return { patch: { ...counts, status: "partial", status_reason: "The source returned an empty page but did not confirm completion.", finished_at: new Date().toISOString() }, results, done: true };
  }
  return { patch: { ...counts, status: "running" }, results, done: false };
}
