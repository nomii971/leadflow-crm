"use client";
// Browser-side file reading. CSV is streamed with Papa Parse so large files never sit in memory as one array;
// XLSX is read with SheetJS (whole workbook, which is how the format works).
import Papa from "papaparse";

export type Row = Record<string, unknown>;

export const isExcel = (f: File) => /\.(xlsx|xls)$/i.test(f.name);

async function readWorkbookRows(file: File): Promise<{ headers: string[]; rows: Row[] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, dense: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false, blankrows: false });
  const headerRow = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: 0, blankrows: false })[0] ?? []).map((h) => String(h ?? "").trim());
  return { headers: headerRow.filter(Boolean), rows };
}

const xlsxCache = new WeakMap<File, Promise<{ headers: string[]; rows: Row[] }>>();
const workbook = (f: File) => {
  let p = xlsxCache.get(f);
  if (!p) { p = readWorkbookRows(f); xlsxCache.set(f, p); }
  return p;
};

/** Headers and the first `n` rows, for mapping and preview. */
export async function previewFile(file: File, n = 50): Promise<{ headers: string[]; rows: Row[] }> {
  if (isExcel(file)) {
    const wb = await workbook(file);
    return { headers: wb.headers, rows: wb.rows.slice(0, n) };
  }
  return new Promise((resolve, reject) => {
    Papa.parse<Row>(file, {
      header: true,
      preview: n,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (r) => resolve({ headers: (r.meta.fields ?? []).filter(Boolean), rows: r.data }),
      error: (e) => reject(e),
    });
  });
}

/**
 * Streams the file in batches. `onBatch` receives rows and the 1-based data-row number of the first row.
 * Return false from onBatch to stop early (cancel). Resolves with the number of rows read.
 */
export async function streamRows(
  file: File,
  batchSize: number,
  onBatch: (rows: Row[], startRow: number) => Promise<boolean>,
  opts: { skip?: number } = {},
): Promise<number> {
  const skip = opts.skip ?? 0;
  if (isExcel(file)) {
    const { rows } = await workbook(file);
    let read = skip;
    for (let i = skip; i < rows.length; i += batchSize) {
      const part = rows.slice(i, i + batchSize);
      read = i + part.length;
      if (!(await onBatch(part, i + 1))) return read;
    }
    return Math.max(read, rows.length);
  }
  return new Promise((resolve, reject) => {
    let seen = 0;
    let buffer: Row[] = [];
    let bufferStart = 1;
    let stopped = false;
    let failed = false;
    let inflight: Promise<void> = Promise.resolve();
    const flush = async () => {
      while (buffer.length >= batchSize && !stopped) {
        const part = buffer.slice(0, batchSize);
        buffer = buffer.slice(batchSize);
        const start = bufferStart;
        bufferStart += part.length;
        if (!(await onBatch(part, start))) stopped = true;
      }
    };
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      chunkSize: 512 * 1024,
      chunk: (results, parser) => {
        parser.pause();
        for (const row of results.data) {
          seen++;
          if (seen <= skip) { bufferStart = seen + 1; continue; }
          buffer.push(row);
        }
        inflight = flush()
          .then(() => (stopped ? parser.abort() : parser.resume()))
          .catch((e) => { failed = true; parser.abort(); reject(e); });
      },
      complete: async () => {
        try {
          await inflight;
          if (failed) return;
          if (!stopped && buffer.length) {
            const start = bufferStart;
            const part = buffer;
            buffer = [];
            await onBatch(part, start);
          }
          resolve(seen);
        } catch (e) {
          reject(e);
        }
      },
      error: (e) => reject(e),
    });
  });
}

/** Counts data rows without keeping them in memory. */
export async function countRows(file: File): Promise<number> {
  if (isExcel(file)) return (await workbook(file)).rows.length;
  return new Promise((resolve, reject) => {
    let n = 0;
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: "greedy",
      chunkSize: 1024 * 1024,
      chunk: (r) => { n += r.data.length; },
      complete: () => resolve(n),
      error: (e) => reject(e),
    });
  });
}

export function rowsToCsv(rows: Row[], columns?: string[]) {
  return Papa.unparse(rows, columns ? { columns } : undefined);
}
