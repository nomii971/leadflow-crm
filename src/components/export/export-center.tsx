"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Callout, Spinner } from "@/components/ui/misc";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { EXPORT_DEFAULT_COLUMNS, LEAD_FIELDS, type LeadFieldKey } from "@/lib/leads/fields";
import { LEAD_STATUSES } from "@/lib/constants";
import type { LeadFilters } from "@/lib/leads/query";
import { downloadExport } from "@/lib/download";
import { cn, formatNumber } from "@/lib/utils";
import { countLeads } from "@/app/(app)/export/actions";

type Scope = "all" | "filtered" | "country" | "city" | "industry" | "job_title" | "list" | "job";
const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "All leads" }, { id: "filtered", label: "Filtered leads" }, { id: "country", label: "By country" },
  { id: "city", label: "By city" }, { id: "industry", label: "By industry" }, { id: "job_title", label: "By job title" },
  { id: "list", label: "A lead list" }, { id: "job", label: "Collection job results" },
];

export function ExportCenter({ lists, jobs, top }: {
  lists: { id: string; name: string }[]; jobs: { id: string; name: string }[];
  top: Record<"country" | "city" | "industry" | "job_title", { label: string; value: number }[]>;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [value, setValue] = useState("");
  const [f, setF] = useState<LeadFilters>({});
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [columns, setColumns] = useState<LeadFieldKey[]>(EXPORT_DEFAULT_COLUMNS);
  const [count, setCount] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [deleteAfter, setDeleteAfter] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  const runExport = () => start(async () => {
    let res;
    try { res = await downloadExport({ target: { filters }, format, columns, name }); }
    catch (e) { toast.error((e as Error).message); return; }
    if (!deleteAfter) { toast.success("Download started"); return; }
    if (res.capped || !res.exportedAt) {
      toast.warning("Download started. Nothing was deleted: this export hit the 100,000-row limit, so export in smaller parts to delete.");
      return;
    }
    toast.success(`Download started (${formatNumber(res.count)} leads). Removing them from the database…`);
    try {
      const r = await fetch("/api/export/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, exportedAt: res.exportedAt, exportedCount: res.count }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Delete failed (${r.status})`);
      const kept = j.kept > 0 ? ` ${formatNumber(j.kept)} ${j.kept === 1 ? "lead was" : "leads were"} kept because ${j.kept === 1 ? "it" : "they"} changed after the export.` : "";
      toast.success(`Deleted ${formatNumber(j.deleted)} exported leads from the database.${kept}`);
      setCount(null);
      router.refresh();
    } catch (e) {
      toast.error(`Your file was downloaded, but deleting failed: ${(e as Error).message}`);
    }
  });

  const filters: LeadFilters =
    scope === "all" ? {} :
    scope === "filtered" ? f :
    scope === "list" ? (value ? { list_id: value } : {}) :
    scope === "job" ? (value ? { collection_job_id: value } : {}) :
    value ? { [scope]: value } : {};
  const ready = scope === "all" || scope === "filtered" || !!value;
  const key = JSON.stringify(filters);

  useEffect(() => {
    if (!ready) return setCount(null);
    let alive = true;
    const t = setTimeout(async () => {
      const r = await countLeads(filters);
      if (alive) setCount(r.ok ? r.count : null);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  const name = scope === "all" ? "all-leads" : scope === "list" ? `list-${lists.find((l) => l.id === value)?.name ?? ""}` : scope === "job" ? `collection-${jobs.find((j) => j.id === value)?.name ?? ""}` : scope === "filtered" ? "filtered-leads" : `${scope}-${value}`;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>What to export</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <button key={s.id} onClick={() => { setScope(s.id); setValue(""); }}
                  className={cn("rounded-full border px-3 py-1.5 text-sm", scope === s.id ? "border-brand-500 bg-brand-600 text-white" : "border-slate-200 bg-white hover:border-slate-300")}>{s.label}</button>
              ))}
            </div>
            {["country", "city", "industry", "job_title"].includes(scope) ? (
              <Field label={SCOPES.find((s) => s.id === scope)!.label.replace("By ", "")}>
                <Input list="export-values" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type or pick a value" />
                <datalist id="export-values">{top[scope as keyof typeof top].map((t) => <option key={t.label} value={t.label}>{`${t.value} leads`}</option>)}</datalist>
              </Field>
            ) : null}
            {scope === "list" ? (
              <Field label="List"><Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose a list</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            ) : null}
            {scope === "job" ? (
              <Field label="Collection job"><Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose a job</option>{jobs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            ) : null}
            {scope === "filtered" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {(["country", "city", "industry", "job_title", "company", "lead_source"] as const).map((k) => (
                  <Field key={k} label={k.replace("_", " ").replace(/^./, (c) => c.toUpperCase())}><Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value || undefined })} /></Field>
                ))}
                <Field label="Status"><Select value={f.status ?? ""} onChange={(e) => setF({ ...f, status: e.target.value || undefined })}><option value="">Any</option>{LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
                <Field label="Verified"><Select value={f.verified ?? ""} onChange={(e) => setF({ ...f, verified: (e.target.value || undefined) as "yes" })}><option value="">Any</option><option value="yes">Verified</option><option value="no">Unverified</option></Select></Field>
                <Field label="Added from"><Input type="date" value={f.created_from ?? ""} onChange={(e) => setF({ ...f, created_from: e.target.value || undefined })} /></Field>
              </div>
            ) : null}
            <p className="text-xs text-slate-500">Selected leads can also be exported straight from the All Leads table.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Columns</CardTitle><CardDescription>{columns.length} selected, exported in this order</CardDescription></div>
            <div className="flex gap-2 text-xs">
              <button className="text-brand-600" onClick={() => setColumns(LEAD_FIELDS.map((x) => x.key))}>All</button>
              <button className="text-brand-600" onClick={() => setColumns(EXPORT_DEFAULT_COLUMNS)}>Default</button>
              <button className="text-brand-600" onClick={() => setColumns(["full_name"])}>Clear</button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LEAD_FIELDS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={columns.includes(c.key)} onChange={(e) => setColumns(e.target.checked ? [...columns, c.key] : columns.filter((x) => x !== c.key))} />
                {c.label}
              </label>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader><CardTitle>Download</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["xlsx", "csv"] as const).map((x) => (
              <button key={x} onClick={() => setFormat(x)} className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium", format === x ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200")}>
                <FileSpreadsheet className="size-4" />{x === "xlsx" ? "Excel (.xlsx)" : "CSV"}
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            {ready ? (count === null ? <span className="text-slate-500">Counting…</span> : <><b className="text-lg tabular-nums">{formatNumber(count)}</b> leads will be exported{count > 100000 ? " (first 100,000)" : ""}</>) : <span className="text-slate-500">Choose what to export</span>}
          </div>
          <label className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", deleteAfter ? "border-rose-200 bg-rose-50/60" : "border-slate-200")}>
            <Checkbox className="mt-0.5" checked={deleteAfter} onChange={(e) => setDeleteAfter(e.target.checked)} />
            <span>
              <span className="font-medium">Delete from database after download</span>
              <span className="block text-xs text-slate-500">Frees space on the free 500 MB database. The exported leads and their notes, activities and tasks are removed permanently.</span>
            </span>
          </label>
          <Button className="w-full" size="lg" variant={deleteAfter ? "destructive" : "default"} disabled={!ready || pending || count === 0 || columns.length === 0}
            onClick={() => (deleteAfter ? setConfirmOpen(true) : runExport())}>
            {pending ? <Spinner /> : deleteAfter ? <Trash /> : <Download />} {deleteAfter ? `Export ${format.toUpperCase()} & delete` : `Export ${format.toUpperCase()}`}
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent title="Export and delete these leads?" description="The file downloads first. Only the leads in that file are then deleted.">
              <div className="space-y-4 text-sm">
                <Callout tone="danger">
                  <b className="tabular-nums">{formatNumber(count ?? 0)}</b> leads will be downloaded and then <b>permanently deleted</b> from the database, together with their notes, activities, tasks and list memberships. This cannot be undone. Keep the downloaded file safe: it will be your only copy.
                </Callout>
                {count !== null && count > 100000 ? <Callout tone="warning">This is more than 100,000 leads, so only a download happens. Export in smaller parts (for example by country or city) to delete.</Callout> : null}
                <p className="text-xs text-slate-500">Deleted leads are no longer checked for duplicates. If you import the same leads again, they will be saved as new.</p>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button variant="destructive" onClick={() => { setConfirmOpen(false); runExport(); }}><Trash /> Download & delete {formatNumber(count ?? 0)}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <p className="text-xs text-slate-500">CSV cells that could run as spreadsheet formulas are escaped. Files are generated on the server from live data.</p>
        </CardContent>
      </Card>
    </div>
  );
}
