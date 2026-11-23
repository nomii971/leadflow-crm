import { z } from "zod";
import { SourceConfigError, type SourceAdapter } from "../types";

const payloadSchema = z.object({
  offset: z.number().int().min(0),
  totalRows: z.number().int().min(0),
  isLast: z.boolean(),
  rows: z.array(z.record(z.string(), z.unknown())).max(500),
});

/**
 * Authorized export file (CSV/XLSX) as a paginated source. The browser reads the file locally and
 * sends it page by page; the server applies the job's location/professional filters and saves matches.
 * Use for: Sales Navigator leads synced to a CRM then exported, data-provider exports you are licensed to use, etc.
 */
export const fileAdapter: SourceAdapter = {
  id: "file_upload",
  name: "Authorized export file (CSV / XLSX)",
  description:
    "Process a lead export you are permitted to use, page by page, keeping only rows that match your locations and filters.",
  kind: "file",
  capabilities: {
    pagination: true,
    totalCount: true,
    pauseResume: true,
    locationFilters: true,
    professionalFilters: true,
    maxPageSize: 500,
  },
  async status() {
    return { state: "available", label: "Available", detail: "Works offline with any CSV or XLSX export. No account needed." };
  },
  async fetchPage({ cursor, payload }) {
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) throw new SourceConfigError("This job reads a file from your browser. Select the file to continue.");
    const expected = (cursor as { offset?: number } | null)?.offset ?? 0;
    if (parsed.data.offset !== expected) {
      throw new SourceConfigError(`Page offset mismatch (expected row ${expected}, got ${parsed.data.offset}).`);
    }
    const { rows, isLast, totalRows, offset } = parsed.data;
    return {
      records: rows.map((r, i) => ({ sourceId: `row:${offset + i + 2}`, data: r, raw: r })),
      nextCursor: isLast ? null : { offset: offset + rows.length },
      totalReported: totalRows,
      serverSideFiltered: false,
    };
  },
};
