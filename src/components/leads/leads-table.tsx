"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, ExternalLink, ListPlus, Trash } from "lucide-react";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Checkbox, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/misc";
import { LeadStatusBadge, PriorityBadge } from "@/components/shared/status-badges";
import { useUrlParams } from "./filter-bar";
import { DEFAULT_TABLE_COLUMNS, LEAD_FIELDS, type LeadFieldKey } from "@/lib/leads/fields";
import { LEAD_STATUSES, ORIGINS, PRIORITIES } from "@/lib/constants";
import type { LeadFilters } from "@/lib/leads/query";
import type { Lead } from "@/lib/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { addLeadsToList, bulkDeleteLeads, bulkUpdateLeads, removeLeadsFromList } from "@/app/(app)/leads/actions";
import { downloadExport } from "@/lib/download";

const COLS_KEY = "leadflow.leadColumns";
const SORTABLE = new Set(["created_at", "full_name", "job_title", "company_name", "country", "city", "industry", "status", "priority", "last_contacted_at"]);
const DATE_COLS = new Set(["created_at", "last_contacted_at", "collected_at"]);

function cell(lead: Lead, key: LeadFieldKey) {
  const v = (lead as unknown as Record<string, unknown>)[key];
  if (key === "status") return <LeadStatusBadge status={lead.status} />;
  if (key === "priority") return <PriorityBadge priority={lead.priority} />;
  if (key === "origin") return ORIGINS.find((o) => o.value === lead.origin)?.label ?? lead.origin;
  if (DATE_COLS.has(key)) return formatDate(v as string);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key === "linkedin_url" && v)
    return <a href={String(v)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">Profile <ExternalLink className="size-3" /></a>;
  return v === null || v === undefined || v === "" ? <span className="text-slate-300">—</span> : String(v);
}

export function LeadsTable({
  leads, total, page, pageSize, filters, sort, dir, lists, listContext,
}: {
  leads: Lead[]; total: number; page: number; pageSize: number; filters: LeadFilters; sort: string; dir: "asc" | "desc";
  lists: { id: string; name: string }[]; listContext?: string;
}) {
  const router = useRouter();
  const { set } = useUrlParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [columns, setColumns] = useState<LeadFieldKey[]>(DEFAULT_TABLE_COLUMNS);
  const [colsOpen, setColsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, start] = useTransition();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLS_KEY) ?? "null");
      if (Array.isArray(saved) && saved.length) setColumns(saved.filter((k) => LEAD_FIELDS.some((f) => f.key === k)));
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { setSelected(new Set()); setAllMatching(false); }, [leads]);

  const saveColumns = (c: LeadFieldKey[]) => {
    setColumns(c);
    try { localStorage.setItem(COLS_KEY, JSON.stringify(c)); } catch { /* ignore */ }
  };

  const pageIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const count = allMatching ? total : selected.size;
  const target = allMatching ? { filters } : { ids: Array.from(selected) };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: { count: number } }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Failed");
      else { toast.success(`${msg} (${formatNumber(r.data?.count ?? count)} leads)`); router.refresh(); }
    });

  const toggleSort = (k: string) => {
    if (!SORTABLE.has(k)) return;
    set({ sort: k, dir: sort === k && dir === "desc" ? "asc" : "desc" }, false);
  };

  return (
    <div className="rounded-xl border bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm text-slate-600">
          {count > 0 ? <b className="text-slate-900">{formatNumber(count)} selected</b> : <>{formatNumber(total)} leads</>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {count > 0 ? (
            <>
              <Select className="h-8 w-40 text-xs" value="" disabled={busy}
                onChange={(e) => e.target.value && run(() => bulkUpdateLeads(target, { status: e.target.value }), "Status updated")}>
                <option value="">Set status…</option>
                {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Select className="h-8 w-36 text-xs" value="" disabled={busy}
                onChange={(e) => e.target.value && run(() => bulkUpdateLeads(target, { priority: e.target.value }), "Priority updated")}>
                <option value="">Set priority…</option>
                {PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Select className="h-8 w-44 text-xs" value="" disabled={busy || lists.length === 0}
                onChange={(e) => e.target.value && run(() => addLeadsToList(target, e.target.value), "Added to list")}>
                <option value="">{lists.length ? "Add to list…" : "No lists yet"}</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
              {listContext && !allMatching ? (
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => run(async () => removeLeadsFromList(listContext, Array.from(selected)) as Promise<{ ok: boolean; error?: string }>, "Removed from list")}>
                  <ListPlus /> Remove from list
                </Button>
              ) : null}
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => start(async () => {
                  try { await downloadExport({ target, format: "xlsx" }); toast.success("Export ready"); } catch (e) { toast.error((e as Error).message); }
                })}>
                <Download /> Export
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash /> Delete</Button>
            </>
          ) : null}
          {busy ? <Spinner /> : null}
          <Button size="sm" variant="ghost" onClick={() => setColsOpen(true)}><Columns3 /> Columns</Button>
        </div>
      </div>

      {allOnPage && !allMatching && total > pageIds.length ? (
        <div className="border-b bg-brand-50/60 px-3 py-2 text-center text-xs text-slate-700">
          All {pageIds.length} leads on this page are selected.{" "}
          <button className="font-semibold text-brand-700 hover:underline" onClick={() => setAllMatching(true)}>
            Select all {formatNumber(total)} matching leads
          </button>
        </div>
      ) : null}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH className="w-10">
              <Checkbox aria-label="Select page" checked={allOnPage}
                onChange={(e) => { setAllMatching(false); setSelected(e.target.checked ? new Set(pageIds) : new Set()); }} />
            </TH>
            {columns.map((k) => (
              <TH key={k} className={cn(SORTABLE.has(k) && "cursor-pointer select-none hover:text-slate-800")} onClick={() => toggleSort(k)}>
                <span className="inline-flex items-center gap-1">
                  {LEAD_FIELDS.find((f) => f.key === k)?.label}
                  {SORTABLE.has(k) ? <ArrowUpDown className={cn("size-3", sort === k ? "text-brand-600" : "text-slate-300")} /> : null}
                </span>
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {leads.length === 0 ? (
            <TR><TD colSpan={columns.length + 1} className="py-16 text-center text-sm text-slate-500">No leads match these filters.</TD></TR>
          ) : null}
          {leads.map((l) => (
            <TR key={l.id} data-selected={allMatching || selected.has(l.id)}>
              <TD>
                <Checkbox aria-label={`Select ${l.full_name}`} checked={allMatching || selected.has(l.id)}
                  onChange={(e) => {
                    setAllMatching(false);
                    const n = new Set(selected);
                    if (e.target.checked) n.add(l.id); else n.delete(l.id);
                    setSelected(n);
                  }} />
              </TD>
              {columns.map((k) => (
                <TD key={k} className={cn("max-w-64 truncate", k === "full_name" && "font-medium")}>
                  {k === "full_name" ? (
                    <Link href={`/leads/${l.id}`} className="hover:text-brand-600 hover:underline">{l.full_name}</Link>
                  ) : cell(l, k)}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          Rows
          <Select className="h-8 w-20 text-xs" value={String(pageSize)} onChange={(e) => set({ per: e.target.value })}>
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Page {formatNumber(page)} of {formatNumber(pages)}</span>
          <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} aria-label="Previous page"><ChevronLeft /></Button>
          <Button size="icon" variant="outline" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, false)} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </div>

      <Dialog open={colsOpen} onOpenChange={setColsOpen}>
        <DialogContent title="Table columns" description="Choose which columns to show. Saved in this browser.">
          <div className="grid grid-cols-2 gap-2">
            {LEAD_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={columns.includes(f.key)}
                  onChange={(e) => saveColumns(e.target.checked ? [...columns, f.key] : columns.filter((c) => c !== f.key))} />
                {f.label}
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end"><Button variant="outline" size="sm" onClick={() => saveColumns(DEFAULT_TABLE_COLUMNS)}>Reset to default</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title={`Delete ${formatNumber(count)} leads?`} description="This permanently deletes the leads with their notes, activities and tasks. It cannot be undone.">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={() => { setConfirmDelete(false); run(() => bulkDeleteLeads(target), "Deleted"); }}>Delete permanently</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
