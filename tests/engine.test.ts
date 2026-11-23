import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executeStep, type JobSnapshot } from "@/lib/collector/engine";
import { RetryableSourceError, SourceRestrictionError, type SourceAdapter, type FetchPageResult } from "@/lib/collector/types";
import type { IncomingRecord, RecordOutcome } from "@/lib/leads/writer";
import { fileAdapter } from "@/lib/collector/adapters/file";
import { buildHubspotFilterGroups } from "@/lib/collector/adapters/hubspot";

const baseJob = (over: Partial<JobSnapshot> = {}): JobSnapshot => ({
  id: "j", status: "running", config: { locations: [], filters: {} }, max_records: 1000, page_size: 2,
  duplicate_strategy: "skip_duplicates", total_reported: null, retrieved_count: 0, saved_count: 0, updated_count: 0,
  duplicate_count: 0, review_count: 0, filtered_count: 0, failed_count: 0, pages_fetched: 0, cursor: null, retry_count: 0, ...over,
});

const person = (n: number, extra: Record<string, unknown> = {}) => ({ sourceId: `s${n}`, raw: {}, data: { full_name: `Person ${n}`, country: "United Kingdom", city: "London", job_title: "Marketing Manager", ...extra } });

/** Fake paginated source with N records. */
function fakeAdapter(total: number, opts: { failTimes?: number; restrictAfter?: number } = {}): SourceAdapter & { calls: number } {
  let fails = opts.failTimes ?? 0;
  const a = {
    id: "fake", name: "Fake", description: "", kind: "api" as const, calls: 0,
    capabilities: { pagination: true, totalCount: true, pauseResume: true, locationFilters: true, professionalFilters: true, maxPageSize: 100 },
    status: async () => ({ state: "connected" as const, label: "", detail: "" }),
    async fetchPage({ cursor, pageSize }: { cursor: unknown; pageSize: number }): Promise<FetchPageResult> {
      a.calls++;
      if (fails-- > 0) throw new RetryableSourceError("503");
      const off = (cursor as { off: number } | null)?.off ?? 0;
      if (opts.restrictAfter !== undefined && off >= opts.restrictAfter) throw new SourceRestrictionError("cap");
      const recs = Array.from({ length: Math.max(0, Math.min(pageSize, total - off)) }, (_, i) => person(off + i));
      const next = off + recs.length < total ? { off: off + recs.length } : null;
      return { records: recs, nextCursor: next, totalReported: total, serverSideFiltered: true };
    },
  };
  return a;
}

const writer = vi.fn(async (recs: IncomingRecord[]): Promise<RecordOutcome[]> => recs.map((r) => ({ index: r.index, outcome: "inserted", leadId: `L${r.index}` })));

async function runAll(job: JobSnapshot, adapter: SourceAdapter) {
  let j = job;
  for (let i = 0; i < 100; i++) {
    const out = await executeStep(j, { adapter, writeRecords: writer, sleep: async () => {} });
    j = { ...j, ...out.patch } as JobSnapshot;
    if (out.done) return j;
  }
  throw new Error("did not finish");
}

describe("collection engine", () => {
  it("fetches all pages until the source reports completion", async () => {
    const j = await runAll(baseJob(), fakeAdapter(5));
    expect(j.status).toBe("complete");
    expect(j.retrieved_count).toBe(5);
    expect(j.saved_count).toBe(5);
    expect(j.pages_fetched).toBe(3);
    expect(j.total_reported).toBe(5);
  });

  it("stops at the configured record limit and never retrieves past it", async () => {
    const j = await runAll(baseJob({ max_records: 3 }), fakeAdapter(10));
    expect(j.status).toBe("limit_reached");
    expect(j.retrieved_count).toBe(3);
  });

  it("retries temporary errors then continues", async () => {
    const a = fakeAdapter(2, { failTimes: 2 });
    const j = await runAll(baseJob(), a);
    expect(j.status).toBe("complete");
    expect(j.retry_count).toBe(2);
  });

  it("fails (resumably) when retries are exhausted, without advancing the cursor", async () => {
    const out = await executeStep(baseJob({ cursor: { off: 4 } }), { adapter: fakeAdapter(10, { failTimes: 9 }), writeRecords: writer, sleep: async () => {} });
    expect(out.patch.status).toBe("failed");
    expect(out.patch.cursor).toBeUndefined();
  });

  it("marks a source restriction as partially complete", async () => {
    const j = await runAll(baseJob(), fakeAdapter(10, { restrictAfter: 4 }));
    expect(j.status).toBe("partial");
    expect(j.retrieved_count).toBe(4);
  });

  it("applies location and professional filters locally and reports filtered + failed records", async () => {
    const adapter: SourceAdapter = {
      ...fakeAdapter(0),
      fetchPage: async () => ({
        records: [person(1), person(2, { city: "Leeds" }), person(3, { job_title: "CEO" }), { sourceId: "bad", raw: { x: 1 }, data: { country: "United Kingdom", city: "London", job_title: "Marketing Manager" } }],
        nextCursor: null, totalReported: 4, serverSideFiltered: false,
      }),
    };
    const job = baseJob({ page_size: 10, config: { locations: [{ country: "UK", city: "london" }], filters: { jobTitles: ["marketing"] } } });
    const out = await executeStep(job, { adapter, writeRecords: writer });
    expect(out.patch).toMatchObject({ status: "complete", retrieved_count: 4, saved_count: 1, filtered_count: 2, failed_count: 1 });
    expect(out.results.find((r) => r.outcome === "failed")?.error_message).toMatch(/name is required/i);
  });

  it("does nothing for a paused job", async () => {
    const out = await executeStep(baseJob({ status: "paused" }), { adapter: fakeAdapter(5), writeRecords: writer });
    expect(out.patch.status).toBe("paused");
    expect(out.results).toHaveLength(0);
  });
});

describe("file adapter", () => {
  it("rejects out-of-order pages and completes on the last page", async () => {
    await expect(fileAdapter.fetchPage({ config: { locations: [], filters: {} }, cursor: { offset: 10 }, pageSize: 5, payload: { offset: 0, totalRows: 20, isLast: false, rows: [] } })).rejects.toThrow(/offset/i);
    const r = await fileAdapter.fetchPage({ config: { locations: [], filters: {} }, cursor: { offset: 15 }, pageSize: 5, payload: { offset: 15, totalRows: 20, isLast: true, rows: [{ full_name: "A" }] } });
    expect(r.nextCursor).toBeNull();
    expect(r.totalReported).toBe(20);
  });
});

describe("hubspot filter groups", () => {
  it("groups cities by country", () => {
    const g = buildHubspotFilterGroups({ locations: [{ country: "United Arab Emirates", city: "Dubai" }, { country: "UAE", city: "Abu Dhabi" }, { country: "Pakistan" }], filters: { jobTitles: ["CEO"] } });
    expect(g.filterGroups).toHaveLength(2);
    const uae = g.filterGroups[0].filters;
    expect(uae.find((f) => f.propertyName === "city")?.values).toEqual(expect.arrayContaining(["Dubai", "Abu Dhabi"]));
    expect(uae.find((f) => f.propertyName === "jobtitle")).toBeTruthy();
    expect(g.filterGroups[1].filters.find((f) => f.propertyName === "city")).toBeUndefined();
  });
});
