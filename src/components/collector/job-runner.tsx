"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Pause, Play, Square, TriangleExclamationPoint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Callout, Spinner } from "@/components/ui/misc";
import { CollectionStatusBadge, effectiveCollectionStatus } from "@/components/shared/status-badges";
import { COLLECTION_STATUS_META } from "@/lib/constants";
import { streamRows } from "@/lib/csv/reader";
import { downloadExport } from "@/lib/download";
import type { CollectionJob } from "@/lib/types";
import { cn, formatDate, formatNumber, sleep } from "@/lib/utils";
import { takeFile } from "./file-stash";

async function call(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: j };
}

function mapRow(raw: Record<string, unknown>, mapping: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [h, f] of Object.entries(mapping)) if (f && raw[h] !== undefined && raw[h] !== "" && out[f] === undefined) out[f] = raw[h];
  return out;
}

export function JobRunner({ initial }: { initial: CollectionJob }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [job, setJob] = useState(initial);
  const [running, setRunning] = useState(false);
  const [file, setFile] = useState<File | null>(() => takeFile(initial.id));
  const [newLimit, setNewLimit] = useState(String(initial.max_records * 2));
  const stopRef = useRef(false);
  const jobRef = useRef(job);
  jobRef.current = job;
  const isFile = job.source_adapter === "file_upload";
  const fileMeta = job.config.file;
  const fileMatches = !isFile || (file && fileMeta && file.name === fileMeta.name && file.size === fileMeta.size);

  const applyStep = (r: { ok: boolean; status: number; body: { job?: CollectionJob; error?: string; done?: boolean } }) => {
    if (r.body.job) { jobRef.current = r.body.job; setJob(r.body.job); }
    if (!r.ok) throw Object.assign(new Error(r.body.error ?? `Step failed (${r.status})`), { status: r.status });
    return r.body.done ?? false;
  };

  const step = useCallback(async (payload?: unknown) => {
    for (let attempt = 1; ; attempt++) {
      const r = await call(`/api/collector/${initial.id}/step`, { step_seq: jobRef.current.step_seq, payload }).catch(() => ({ ok: false, status: 0, body: {} as { error?: string } }));
      if (r.ok || (r.status !== 0 && r.status < 500 && r.status !== 429) || attempt >= 4) return applyStep(r);
      await sleep(1500 * attempt); // network blip / 5xx: retry the same step (server-side lock keeps it idempotent)
    }
  }, [initial.id]);

  const loop = useCallback(async () => {
    setRunning(true);
    stopRef.current = false;
    try {
      if (isFile) {
        if (!file) throw new Error("Select the source file to continue.");
        const meta = jobRef.current.config.file!;
        const offset = ((jobRef.current.cursor as { offset?: number } | null)?.offset) ?? 0;
        await streamRows(file, jobRef.current.page_size, async (rows, startRow) => {
          if (stopRef.current || jobRef.current.status !== "running") return false;
          const payload = { offset: startRow - 1, totalRows: meta.rows, isLast: startRow - 1 + rows.length >= meta.rows, rows: rows.map((r) => mapRow(r, meta.mapping ?? {})) };
          const done = await step(payload);
          return !done && !stopRef.current;
        }, { skip: offset });
        // A file that ends before the expected row count still needs a final empty page to complete.
        if (jobRef.current.status === "running" && !stopRef.current) {
          const off = ((jobRef.current.cursor as { offset?: number } | null)?.offset) ?? 0;
          await step({ offset: off, totalRows: meta.rows, isLast: true, rows: [] });
        }
      } else {
        while (!stopRef.current && jobRef.current.status === "running") {
          if (await step()) break;
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      router.refresh();
    }
  }, [file, isFile, step, router]);

  const control = async (action: "start" | "pause" | "cancel" | "extend", extra: Record<string, unknown> = {}) => {
    if (action === "pause" || action === "cancel") stopRef.current = true;
    const r = await call(`/api/collector/${initial.id}/control`, { action, ...extra });
    if (!r.ok) return void toast.error(r.body.error ?? "Failed");
    setJob(r.body);
    jobRef.current = r.body;
    if (action === "start") loop();
  };

  useEffect(() => {
    if (sp.get("autostart") === "1" && job.status === "queued" && fileMatches) {
      router.replace(`/collector/${initial.id}`);
      control("start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eff = effectiveCollectionStatus(job.status, job.last_heartbeat_at);
  const canResume = ["queued", "paused", "failed", "interrupted"].includes(job.status) || eff === "stalled";
  const total = job.total_reported;
  const target = total !== null ? Math.min(total, job.max_records) : job.max_records;
  const pct = target ? Math.min(100, Math.round((job.retrieved_count / target) * 100)) : 0;
  const remaining = total !== null ? Math.max(0, total - job.retrieved_count) : null;
  const meta = COLLECTION_STATUS_META[job.status];

  const stats: [string, number | null, string?][] = [
    ["Reported by source", total, "Total matching records the source says exist"],
    ["Retrieved", job.retrieved_count],
    ["Saved (new)", job.saved_count],
    ["Updated", job.updated_count],
    ["Duplicates", job.duplicate_count],
    ["For review", job.review_count],
    ["Filtered out", job.filtered_count, "Did not match your locations / filters"],
    ["Failed", job.failed_count],
    ["Remaining", remaining, remaining === null ? "Unknown: the source does not report totals" : undefined],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">{running ? <Spinner className="text-brand-600" /> : null}<CollectionStatusBadge status={job.status} heartbeat={running ? new Date().toISOString() : job.last_heartbeat_at} /></CardTitle>
            <CardDescription className="mt-1">{job.status_reason ?? meta?.help}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {running || job.status === "running" && eff !== "stalled" ? (
              <>
                <Button variant="outline" onClick={() => control("pause")}><Pause /> Pause</Button>
                <Button variant="destructive" onClick={() => control("cancel")}><Square /> Cancel</Button>
              </>
            ) : null}
            {!running && canResume ? (
              <>
                <Button disabled={!fileMatches} onClick={() => control("start")}><Play /> {job.status === "queued" ? "Start" : "Resume"}</Button>
                {job.status !== "interrupted" ? <Button variant="destructive" onClick={() => control("cancel")}><Square /> Cancel</Button> : null}
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={pct} tone={job.status === "complete" ? "emerald" : job.status === "failed" ? "rose" : ["partial", "interrupted"].includes(job.status) ? "amber" : "brand"} />
          <p className="mt-2 text-sm text-slate-600">
            {formatNumber(job.retrieved_count)} of {total !== null ? `${formatNumber(Math.min(total, job.max_records))} ${total > job.max_records ? `(limit; source reports ${formatNumber(total)})` : ""}` : `max ${formatNumber(job.max_records)} (source total unknown)`} · {formatNumber(job.pages_fetched)} pages · {job.retry_count} retries
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-9">
            {stats.map(([l, v, hint]) => (
              <div key={l} className="rounded-lg bg-slate-50 p-2.5" title={hint}>
                <p className="text-[11px] leading-tight text-slate-500">{l}</p>
                <p className={cn("mt-1 text-base font-semibold tabular-nums", l === "Failed" && v ? "text-rose-600" : l === "Saved (new)" ? "text-emerald-700" : "")}>{v === null ? "—" : formatNumber(v)}</p>
              </div>
            ))}
          </div>
          {job.status === "complete" ? <Callout tone="success" className="mt-4">Complete: the source confirmed there are no more results for this search.</Callout> : null}
          {job.status === "partial" ? <Callout tone="warning" className="mt-4" title="Partially complete">The source imposed a restriction: {job.status_reason}</Callout> : null}
          {job.status === "failed" && job.last_error ? <Callout tone="danger" className="mt-4" title="Failed"><span className="inline-flex items-center gap-1"><TriangleExclamationPoint className="size-4" />{job.last_error}</span> Progress is saved; fix the cause and press Resume.</Callout> : null}
          {job.status === "limit_reached" ? (
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
              <p className="flex-1">Your limit of {formatNumber(job.max_records)} records was reached. More results may exist.</p>
              <Input type="number" className="w-32 bg-white" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} />
              <Button size="sm" onClick={() => control("extend", { max_records: Number(newLimit) })}>Raise limit</Button>
            </div>
          ) : null}
          {isFile && !fileMatches && canResume ? (
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <FileSpreadsheet className="size-5" />
              <span>{file ? "That file does not match. " : ""}Select <b>{fileMeta?.name}</b> ({formatNumber(fileMeta?.rows ?? 0)} rows) again to {job.status === "queued" ? "start" : "resume"}. Browsers cannot keep files between visits.</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          ) : null}
          {running ? <p className="mt-3 text-xs text-slate-500">Keep this tab open while the job runs. If it closes, progress is kept and you can resume from the last saved page.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Downloadable results</CardTitle><CardDescription>Started {formatDate(job.started_at, true)}{job.finished_at ? ` · finished ${formatDate(job.finished_at, true)}` : ""}</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadExport({ target: { filters: { collection_job_id: job.id } }, format: "xlsx" }).catch((e) => toast.error(e.message))}><Download /> Saved leads (XLSX)</Button>
          <Button variant="outline" onClick={() => downloadExport({ target: { filters: { collection_job_id: job.id } }, format: "csv" }).catch((e) => toast.error(e.message))}><Download /> Saved leads (CSV)</Button>
          <Button variant="outline" asChild><a href={`/api/collector/${job.id}/results?outcome=failed`}><Download /> Failed records</a></Button>
          <Button variant="outline" asChild><a href={`/api/collector/${job.id}/results`}><Download /> Full record log</a></Button>
          <Button variant="ghost" asChild><a href={`/leads?collection_job_id=${job.id}`}>View leads in CRM</a></Button>
          {job.review_count ? <Button variant="ghost" asChild><a href="/imports/duplicates">Review duplicates</a></Button> : null}
        </CardContent>
      </Card>
    </div>
  );
}
