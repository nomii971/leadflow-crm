"use client";

export interface ExportResult {
  count: number;
  /** Database time taken before the export read its rows (used by "Export & delete"). */
  exportedAt: string | null;
  /** True when the export hit the row cap, so it may not contain every matching lead. */
  capped: boolean;
}

/** POSTs an export request and saves the returned file. */
export async function downloadExport(body: unknown): Promise<ExportResult> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? "leadflow-export";
  saveBlob(blob, name);
  return {
    count: Number(res.headers.get("x-row-count") ?? 0),
    exportedAt: res.headers.get("x-export-at"),
    capped: res.headers.get("x-export-capped") === "1",
  };
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
