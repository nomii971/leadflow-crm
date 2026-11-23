import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeFormula } from "@/lib/csv/sanitize";
import { fieldLabel, type LeadFieldKey } from "@/lib/leads/fields";
import { applyLeadFilters, leadSelect, type BulkTarget } from "@/lib/leads/query";
import { chunk } from "@/lib/utils";
import { statusLabel } from "@/lib/constants";

export const EXPORT_ROW_CAP = 100_000;

export async function fetchLeadsForExport(supabase: SupabaseClient, target: BulkTarget, columns: LeadFieldKey[]) {
  const cols = Array.from(new Set(["id", ...columns])).join(",");
  const rows: Record<string, unknown>[] = [];
  if ("ids" in target) {
    for (const part of chunk(target.ids, 200)) {
      const { data, error } = await supabase.from("leads").select(cols).in("id", part);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    }
    return rows;
  }
  for (let from = 0; from < EXPORT_ROW_CAP; from += 1000) {
    const { data, error } = await applyLeadFilters(supabase.from("leads").select(leadSelect(cols, target.filters)), target.filters)
      .order("created_at", { ascending: false }).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function present(row: Record<string, unknown>, columns: LeadFieldKey[]) {
  const out: Record<string, unknown> = {};
  for (const c of columns) {
    let v = row[c];
    if (c === "status") v = statusLabel(v as string);
    if (typeof v === "boolean") v = v ? "Yes" : "No";
    out[fieldLabel(c)] = v ?? "";
  }
  return out;
}

export function toCsv(rows: Record<string, unknown>[], columns: LeadFieldKey[]) {
  const data = rows.map((r) => Object.fromEntries(Object.entries(present(r, columns)).map(([k, v]) => [k, escapeFormula(v)])));
  return "﻿" + Papa.unparse({ fields: columns.map(fieldLabel), data: data.map((d) => columns.map((c) => d[fieldLabel(c)])) });
}

export function toXlsx(rows: Record<string, unknown>[], columns: LeadFieldKey[], sheetName = "Leads") {
  const ws = XLSX.utils.json_to_sheet(rows.map((r) => present(r, columns)), { header: columns.map(fieldLabel) });
  ws["!cols"] = columns.map((c) => ({ wch: ["notes", "linkedin_url", "company_website"].includes(c) ? 40 : 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}
