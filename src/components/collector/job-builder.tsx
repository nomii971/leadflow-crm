"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bookmark, FileSpreadsheet, Radar, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Callout, Spinner } from "@/components/ui/misc";
import { LocationPicker, TagInput } from "./location-picker";
import { COLLECTOR_DUPLICATE_STRATEGIES, COMPANY_SIZES, DEPARTMENTS, INDUSTRIES, SENIORITY_LEVELS, type CollectorDuplicateStrategy } from "@/lib/constants";
import { autoMapColumns, IMPORTABLE_FIELDS } from "@/lib/leads/fields";
import { countRows, previewFile } from "@/lib/csv/reader";
import { describeConfig } from "@/lib/collector/filters";
import type { LocationSelection, ProfessionalFilters } from "@/lib/collector/types";
import type { AdapterInfo } from "@/lib/collector/registry";
import { cn, formatNumber } from "@/lib/utils";
import { createCollectionJob, deleteSavedSearch, saveSearch } from "@/app/(app)/collector/actions";
import { stashFile } from "./file-stash";

type Saved = { id: string; name: string; locations: LocationSelection[]; filters: ProfessionalFilters };

const STATE_TONE: Record<string, string> = { connected: "emerald", available: "emerald", not_configured: "amber", unavailable: "slate", error: "rose" };

export function JobBuilder({ adapters, saved: initialSaved }: { adapters: AdapterInfo[]; saved: Saved[] }) {
  const router = useRouter();
  const usable = adapters.filter((a) => ["connected", "available"].includes(a.status.state));
  const [source, setSource] = useState(usable[0]?.id ?? "");
  const [name, setName] = useState("");
  const [locations, setLocations] = useState<LocationSelection[]>([]);
  const [filters, setFilters] = useState<ProfessionalFilters>({});
  const [maxRecords, setMaxRecords] = useState(5000);
  const [pageSize, setPageSize] = useState(100);
  const [strategy, setStrategy] = useState<CollectorDuplicateStrategy>("skip_duplicates");
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{ rows: number; headers: string[]; mapping: Record<string, string> } | null>(null);
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();
  const adapter = adapters.find((a) => a.id === source);

  const setF = <K extends keyof ProfessionalFilters>(k: K, v: ProfessionalFilters[K]) => setFilters({ ...filters, [k]: v });

  const pickFile = async (f?: File) => {
    if (!f) return;
    try {
      const p = await previewFile(f, 5);
      const rows = await countRows(f);
      setFile(f);
      setFileInfo({ rows, headers: p.headers, mapping: autoMapColumns(p.headers) });
      if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const suggestedName = () => {
    const loc = locations.slice(0, 3).map((l) => l.city ?? l.country).join(", ");
    const what = [filters.jobTitles?.[0], filters.industries?.[0]].filter(Boolean).join(" · ");
    return [loc, what].filter(Boolean).join(" — ") || "Bulk collection";
  };

  const submit = () => start(async () => {
    if (!adapter) return void toast.error("Choose a source");
    const r = await createCollectionJob({
      name: name.trim() || suggestedName(),
      source_adapter: source,
      locations,
      filters,
      max_records: maxRecords,
      page_size: pageSize,
      duplicate_strategy: strategy,
      file: adapter.kind === "file" && file && fileInfo ? { name: file.name, size: file.size, rows: fileInfo.rows, mapping: fileInfo.mapping } : undefined,
    });
    if (!r.ok) return void toast.error(r.error);
    if (file) stashFile(r.id, file);
    router.push(`/collector/${r.id}?autostart=1`);
  });

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader><CardTitle>1. Authorized source</CardTitle><CardDescription>Only sources you are permitted to use. No scraping, cookies or private APIs.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-3">
            {adapters.map((a) => {
              const ok = ["connected", "available"].includes(a.status.state);
              return (
                <button type="button" key={a.id} disabled={!ok} onClick={() => setSource(a.id)}
                  className={cn("rounded-xl border p-3 text-left transition", source === a.id ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20" : "border-slate-200 hover:border-slate-300", !ok && "cursor-not-allowed opacity-60")}>
                  <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{a.name}</p><Badge tone={STATE_TONE[a.status.state]}>{a.status.label}</Badge></div>
                  <p className="mt-1 text-xs text-slate-500">{ok ? a.description : a.status.detail}</p>
                </button>
              );
            })}
          </CardContent>
          {adapter?.kind === "file" ? (
            <CardContent>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 hover:border-brand-500">
                <FileSpreadsheet className="size-5 text-brand-600" />
                <span className="text-sm">{file ? <><b>{file.name}</b> · {formatNumber(fileInfo?.rows ?? 0)} rows · {Object.values(fileInfo?.mapping ?? {}).filter(Boolean).length} columns mapped</> : "Select the CSV / XLSX export to process"}</span>
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
              {fileInfo ? (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-brand-600">Review column mapping</summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {fileInfo.headers.map((h) => (
                      <div key={h} className="flex items-center gap-2"><span className="w-40 truncate text-xs">{h}</span>
                        <Select className="h-8 text-xs" value={fileInfo.mapping[h] ?? ""} onChange={(e) => setFileInfo({ ...fileInfo, mapping: { ...fileInfo.mapping, [h]: e.target.value } })}>
                          <option value="">Ignore</option>{IMPORTABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </Select>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader><CardTitle>2. Locations</CardTitle><CardDescription>Select entire countries and/or multiple cities. One job can cover many locations.</CardDescription></CardHeader>
          <CardContent><LocationPicker value={locations} onChange={setLocations} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>3. Professional filters</CardTitle><CardDescription>Values are OR-ed within a filter and AND-ed across filters. Press Enter to add each value.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Job titles"><TagInput value={filters.jobTitles ?? []} onChange={(v) => setF("jobTitles", v)} placeholder="CEO, Marketing Manager…" /></Field>
            <Field label="Industries"><TagInput value={filters.industries ?? []} onChange={(v) => setF("industries", v)} suggestions={INDUSTRIES} placeholder="Real Estate…" /></Field>
            <Field label="Company names"><TagInput value={filters.companyNames ?? []} onChange={(v) => setF("companyNames", v)} placeholder="Optional" /></Field>
            <Field label="Company sizes"><TagInput value={filters.companySizes ?? []} onChange={(v) => setF("companySizes", v)} suggestions={COMPANY_SIZES} placeholder="11-50, 51-200…" /></Field>
            <Field label="Seniority"><TagInput value={filters.seniorities ?? []} onChange={(v) => setF("seniorities", v)} suggestions={SENIORITY_LEVELS} placeholder="Director, CXO…" /></Field>
            <Field label="Departments"><TagInput value={filters.departments ?? []} onChange={(v) => setF("departments", v)} suggestions={DEPARTMENTS} placeholder="Marketing, Sales…" /></Field>
            <Field label="Keywords" className="md:col-span-2" hint="All words must appear somewhere in the record."><Input value={filters.keywords ?? ""} onChange={(e) => setF("keywords", e.target.value)} placeholder="e.g. proptech saas" /></Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="xl:sticky xl:top-6">
          <CardHeader><CardTitle>4. Run settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Job name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={suggestedName()} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Maximum records" hint="Job stops at this limit."><Input type="number" min={1} max={100000} value={maxRecords} onChange={(e) => setMaxRecords(Math.max(1, Math.min(100000, Number(e.target.value) || 1)))} /></Field>
              <Field label="Page size" hint={`Source max ${adapter?.capabilities.maxPageSize ?? "—"}`}><Input type="number" min={1} max={500} value={pageSize} onChange={(e) => setPageSize(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} /></Field>
            </div>
            <Field label="Duplicates">
              <Select value={strategy} onChange={(e) => setStrategy(e.target.value as CollectorDuplicateStrategy)}>
                {COLLECTOR_DUPLICATE_STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><b className="text-slate-800">Search:</b> {describeConfig({ locations, filters })}</div>
            {adapter?.capabilities.maxResultsPerSearch ? <Callout tone="info">{adapter.name} returns at most {formatNumber(adapter.capabilities.maxResultsPerSearch)} results per search. Larger result sets end as “Partially complete”; split by city to get the rest.</Callout> : null}
            <Button className="w-full" size="lg" disabled={pending || !adapter || (adapter.kind === "file" && !file)} onClick={submit}>
              {pending ? <Spinner /> : <Radar />} Start bulk collection
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" disabled={pending || (!locations.length && !Object.values(filters).some((v) => (Array.isArray(v) ? v.length : v)))}
                onClick={() => start(async () => {
                  const r = await saveSearch({ name: name.trim() || suggestedName(), locations, filters });
                  if (!r.ok) return void toast.error(r.error);
                  setSaved([r.search as Saved, ...saved]);
                  toast.success("Search saved");
                })}>
                <Bookmark /> Save this search
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Saved searches</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {saved.length === 0 ? <p className="text-sm text-slate-400">Save frequently used location and filter combinations here.</p> : null}
            {saved.map((s) => (
              <div key={s.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setLocations(s.locations); setFilters(s.filters); setName(s.name); toast.success(`Loaded “${s.name}”`); }}>
                  <p className="truncate text-sm font-medium hover:text-brand-600">{s.name}</p>
                  <p className="line-clamp-2 text-xs text-slate-500">{describeConfig({ locations: s.locations, filters: s.filters })}</p>
                </button>
                <button type="button" aria-label="Delete saved search" onClick={() => start(async () => { await deleteSavedSearch(s.id); setSaved(saved.filter((x) => x.id !== s.id)); })}><Trash className="size-3.5 text-slate-300 hover:text-rose-600" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
