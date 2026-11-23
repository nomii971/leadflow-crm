"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CircleCheck, FileSpreadsheet, TriangleExclamationPoint, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Callout, Spinner } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { autoMapColumns, IMPORTABLE_FIELDS, type LeadFieldKey } from "@/lib/leads/fields";
import { mapAndValidateRow } from "@/lib/leads/validate";
import { keysFor } from "@/lib/leads/dedupe";
import { countRows, previewFile, streamRows, type Row } from "@/lib/csv/reader";
import { isAllowedImportFile } from "@/lib/csv/sanitize";
import { IMPORT_BATCH_SIZE, IMPORT_STRATEGIES, MAX_IMPORT_FILE_BYTES, type ImportStrategy } from "@/lib/constants";
import { cn, formatNumber, sleep } from "@/lib/utils";

type Step = "upload" | "map" | "validate" | "process" | "done";
const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" }, { id: "map", label: "Map columns" }, { id: "validate", label: "Validate & duplicates" },
  { id: "process", label: "Import" }, { id: "done", label: "Report" },
];

interface Totals { processed: number; inserted: number; updated: number; duplicates: number; review: number; failed: number }
const ZERO: Totals = { processed: 0, inserted: 0, updated: 0, duplicates: 0, review: 0, failed: 0 };

async function postJson(url: string, body: unknown, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) return j;
      if ((res.status === 429 || res.status >= 500) && i < attempts) { await sleep(1000 * 2 ** i); continue; }
      const err = new Error(j.error ?? `Request failed (${res.status})`) as Error & { status?: number; body?: unknown };
      err.status = res.status; err.body = j;
      throw err;
    } catch (e) {
      if ((e as { status?: number }).status || i >= attempts) throw e;
      await sleep(1000 * 2 ** i); // network error: retry
    }
  }
}

export function ImportWizard({ defaultStrategy, defaultSource }: { defaultStrategy: ImportStrategy; defaultSource: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, LeadFieldKey | "">>({});
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>(defaultStrategy);
  const [leadSource, setLeadSource] = useState(defaultSource);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ scanned: number; valid: number; invalid: number; inFile: number; strong: number; possible: number; done: boolean } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals>(ZERO);
  const [fatal, setFatal] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!isAllowedImportFile(f.name, f.type)) return void toast.error("Upload a .csv, .xlsx or .xls file.");
    if (f.size > MAX_IMPORT_FILE_BYTES) return void toast.error(`File is larger than ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB. Split it into smaller files.`);
    setBusy(true);
    try {
      const p = await previewFile(f, 50);
      if (!p.headers.length) throw new Error("No header row found. The first row must contain column names.");
      setFile(f); setHeaders(p.headers); setSample(p.rows); setMapping(autoMapColumns(p.headers));
      setTotalRows(null); setCheck(null);
      countRows(f).then(setTotalRows).catch(() => setTotalRows(null));
      setStep("map");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mappedFields = Object.values(mapping).filter(Boolean);
  const hasName = mappedFields.some((k) => ["full_name", "first_name", "last_name"].includes(k));
  const dupField = mappedFields.find((k, i) => mappedFields.indexOf(k) !== i);

  const runCheck = async () => {
    if (!file) return;
    setBusy(true);
    cancelRef.current = false;
    const c = { scanned: 0, valid: 0, invalid: 0, inFile: 0, strong: 0, possible: 0, done: false };
    const seen = new Set<string>();
    setCheck({ ...c });
    try {
      await streamRows(file, 1000, async (rows) => {
        const keys = [];
        for (const raw of rows) {
          c.scanned++;
          const r = mapAndValidateRow(raw, mapping, { lead_source: leadSource });
          if (!r.ok) { c.invalid++; continue; }
          c.valid++;
          const k = keysFor(r.lead);
          const sig = [k.linkedin && `l:${k.linkedin}`, k.email && `e:${k.email}`].filter(Boolean) as string[];
          if (sig.some((s) => seen.has(s))) c.inFile++;
          sig.forEach((s) => seen.add(s));
          keys.push(k);
        }
        if (keys.length) {
          const j = await postJson("/api/import/precheck", { keys });
          for (const m of j.matches as (string | null)[]) {
            if (m === "linkedin_url" || m === "email") c.strong++;
            else if (m === "name_company") c.possible++;
          }
        }
        setCheck({ ...c });
        return !cancelRef.current;
      });
      c.done = true;
      setCheck({ ...c });
    } catch (e) {
      toast.error(`Validation failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setStep("process"); setFatal(null); setTotals(ZERO); cancelRef.current = false;
    let id: string | null = null;
    try {
      const job = await postJson("/api/import", {
        file_name: file.name, file_size: file.size, total_rows: totalRows ?? check?.scanned ?? 0,
        strategy, lead_source: leadSource || null, column_mapping: mapping,
      });
      id = job.id as string;
      setJobId(id);
      const t = { ...ZERO };
      await streamRows(file, IMPORT_BATCH_SIZE, async (rows, startRow) => {
        if (cancelRef.current) return false;
        const r = await postJson(`/api/import/${id}/batch`, { startRow, rows });
        t.processed += rows.length; t.inserted += r.inserted; t.updated += r.updated;
        t.duplicates += r.duplicates; t.review += r.review; t.failed += r.failed;
        setTotals({ ...t });
        return !cancelRef.current;
      });
      await postJson(`/api/import/${id}/finish`, { cancelled: cancelRef.current });
      setStep("done");
    } catch (e) {
      const msg = (e as Error).message;
      setFatal(msg);
      if (id) await postJson(`/api/import/${id}/finish`, { error: msg }).catch(() => undefined);
      setStep("done");
    }
  };

  const total = totalRows ?? check?.scanned ?? null;
  const pct = total ? Math.round((totals.processed / total) * 100) : null;

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const idx = STEPS.findIndex((x) => x.id === step);
          return (
            <li key={s.id} className="flex items-center gap-2">
              <span className={cn("grid size-6 place-items-center rounded-full font-semibold", i < idx ? "bg-emerald-500 text-white" : i === idx ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500")}>{i + 1}</span>
              <span className={cn(i === idx ? "font-semibold text-slate-900" : "text-slate-500")}>{s.label}</span>
              {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-slate-200" /> : null}
            </li>
          );
        })}
      </ol>

      {step === "upload" ? (
        <Card>
          <CardContent className="pt-5">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center transition hover:border-brand-500 hover:bg-brand-50/40"
            >
              {busy ? <Spinner className="size-8 text-brand-600" /> : <Upload className="size-8 text-brand-600" />}
              <div>
                <p className="font-medium">Drop a CSV or Excel file here, or click to browse</p>
                <p className="mt-1 text-sm text-slate-500">Up to {MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB. The file is read in your browser and sent in batches of {IMPORT_BATCH_SIZE} rows.</p>
              </div>
              <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <Callout tone="info" className="mt-4" title="Where do Sales Navigator leads come from?">
              Sales Navigator has no general bulk CSV export. Authorized routes: LinkedIn&apos;s CRM Sync to a supported CRM and that CRM&apos;s export, data providers you are licensed to use, or lists you build yourself. Lead URLs in the file are kept as LinkedIn Profile URL / source references.
            </Callout>
          </CardContent>
        </Card>
      ) : null}

      {step === "map" && file ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-4 text-brand-600" /> {file.name}</CardTitle>
            <CardDescription>{headers.length} columns detected · {totalRows === null ? "counting rows…" : `${formatNumber(totalRows)} data rows`}. Columns were matched automatically; adjust anything that is wrong.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h}</p>
                    <p className="truncate text-xs text-slate-500">e.g. {String(sample.find((r) => r[h])?.[h] ?? "—").slice(0, 60)}</p>
                  </div>
                  <Select className={cn("w-48", mapping[h] ? "border-brand-200 bg-brand-50/40" : "")} value={mapping[h] ?? ""} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as LeadFieldKey | "" })}>
                    <option value="">Do not import</option>
                    {IMPORTABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </Select>
                </div>
              ))}
            </div>
            {!hasName ? <Callout tone="danger" className="mt-4">Map a name column (Full Name, or First Name / Last Name). Rows without a name are reported as invalid.</Callout> : null}
            {dupField ? <Callout tone="warning" className="mt-4">More than one column is mapped to <b>{IMPORTABLE_FIELDS.find((f) => f.key === dupField)?.label}</b>. The first non-empty value wins.</Callout> : null}
            <div className="mt-5 flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button disabled={!hasName} onClick={() => { setStep("validate"); runCheck(); }}>Validate records</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "validate" && file ? (
        <>
          <Card>
            <CardHeader><CardTitle>Preview</CardTitle><CardDescription>First 20 rows after mapping and validation</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead><TR><TH>Row</TH><TH>Check</TH><TH>Name</TH><TH>Title</TH><TH>Company</TH><TH>Location</TH><TH>Email</TH></TR></THead>
                <TBody>
                  {sample.slice(0, 20).map((raw, i) => {
                    const r = mapAndValidateRow(raw, mapping, { lead_source: leadSource });
                    return (
                      <TR key={i}>
                        <TD className="text-xs text-slate-500">{i + 2}</TD>
                        <TD>{r.ok ? <Badge tone="emerald">Valid</Badge> : <Badge tone="rose" className="max-w-64 truncate" >{r.errors[0]}</Badge>}</TD>
                        <TD className="font-medium">{r.ok ? r.lead.full_name : "—"}</TD>
                        <TD>{r.ok ? r.lead.job_title ?? "—" : ""}</TD>
                        <TD>{r.ok ? r.lead.company_name ?? "—" : ""}</TD>
                        <TD>{r.ok ? [r.lead.city, r.lead.country].filter(Boolean).join(", ") || "—" : ""}</TD>
                        <TD>{r.ok ? r.lead.business_email ?? "—" : ""}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Validation & duplicate check</CardTitle><CardDescription>Every row is checked, then compared against your CRM by LinkedIn URL, email, and name + company.</CardDescription></CardHeader>
            <CardContent>
              {check ? (
                <>
                  <Progress value={total ? (check.scanned / total) * 100 : null} indeterminate={!total && !check.done} tone={check.done ? "emerald" : "brand"} />
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
                    {[
                      ["Scanned", check.scanned], ["Valid", check.valid], ["Invalid", check.invalid],
                      ["Already in CRM", check.strong], ["Possible matches", check.possible], ["Repeated in file", check.inFile],
                    ].map(([l, v]) => (
                      <div key={l as string} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{l}</p><p className="text-lg font-semibold tabular-nums">{formatNumber(v as number)}</p></div>
                    ))}
                  </div>
                  {check.invalid > 0 ? <p className="mt-3 text-sm text-slate-600">Invalid rows are <b>not discarded silently</b>: they are recorded with the reason and can be downloaded after the import.</p> : null}
                </>
              ) : null}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Import strategy</p>
                  {IMPORT_STRATEGIES.map((s) => (
                    <label key={s.value} className={cn("flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5", strategy === s.value ? "border-brand-500 bg-brand-50/50" : "border-slate-200")}>
                      <input type="radio" name="strategy" className="mt-1 accent-brand-600" checked={strategy === s.value} onChange={() => setStrategy(s.value)} />
                      <span><span className="block text-sm font-medium">{s.label}</span><span className="block text-xs text-slate-500">{s.help}</span></span>
                    </label>
                  ))}
                </div>
                <div className="space-y-4">
                  <Field label="Default lead source" hint="Used for rows without a Lead Source column value.">
                    <Input value={leadSource} onChange={(e) => setLeadSource(e.target.value)} placeholder="e.g. LinkedIn Sales Navigator (CRM Sync export)" />
                  </Field>
                  <Callout tone="info">Possible matches (same name + company, no shared URL/email) are <b>never merged automatically</b>. They go to the duplicate review queue unless you pick “Import new records only”.</Callout>
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="outline" disabled={busy} onClick={() => setStep("map")}>Back</Button>
                <div className="flex gap-2">
                  {busy ? <Button variant="outline" onClick={() => { cancelRef.current = true; }}>Stop check</Button> : null}
                  <Button disabled={busy && !check?.done} onClick={runImport}>
                    {busy ? <Spinner /> : null} Import {total ? formatNumber(total) : ""} rows
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {step === "process" || step === "done" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === "process" ? <Spinner className="text-brand-600" /> : fatal ? <TriangleExclamationPoint className="size-4 text-rose-600" /> : <CircleCheck className="size-4 text-emerald-600" />}
              {step === "process" ? "Importing…" : fatal ? "Import stopped" : cancelRef.current ? "Import cancelled" : "Import finished"}
            </CardTitle>
            <CardDescription>{file?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={pct} indeterminate={pct === null && step === "process"} tone={fatal ? "rose" : step === "done" ? "emerald" : "brand"} />
            <p className="mt-2 text-sm text-slate-600">{formatNumber(totals.processed)}{total ? ` of ${formatNumber(total)}` : ""} rows processed{pct !== null ? ` (${pct}%)` : ""}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Saved (new)", totals.inserted, "text-emerald-700"], ["Updated", totals.updated, "text-blue-700"],
                ["Duplicates skipped", totals.duplicates, "text-slate-700"], ["Sent to review", totals.review, "text-amber-700"], ["Failed", totals.failed, "text-rose-700"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{l}</p><p className={cn("text-lg font-semibold tabular-nums", c as string)}>{formatNumber(v as number)}</p></div>
              ))}
            </div>
            {fatal ? <Callout tone="danger" className="mt-4" title="Error">{fatal}. Rows already processed are saved; see the report for details.</Callout> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {step === "process" ? <Button variant="outline" onClick={() => { cancelRef.current = true; }}>Cancel after current batch</Button> : null}
              {step === "done" && jobId ? (
                <>
                  <Button asChild><Link href={`/imports/${jobId}`}>Open full report</Link></Button>
                  {totals.failed + totals.duplicates + totals.review > 0 ? <Button variant="outline" asChild><a href={`/api/import/${jobId}/errors`}>Download failed & skipped rows</a></Button> : null}
                  {totals.review > 0 ? <Button variant="outline" asChild><Link href="/imports/duplicates">Review duplicates</Link></Button> : null}
                  <Button variant="ghost" asChild><Link href={`/leads?import_job_id=${jobId}`}>View imported leads</Link></Button>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
