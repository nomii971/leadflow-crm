import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Callout, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ImportStatusBadge } from "@/components/shared/status-badges";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { IMPORT_STRATEGIES } from "@/lib/constants";
import type { ImportJob } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

const TYPE_TONE: Record<string, string> = { validation: "rose", database: "red", duplicate_review: "amber", skipped_duplicate: "slate" };

export default async function ImportReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const { id } = await params;
  const { type } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUserOrRedirect();
  const { data } = await supabase.from("import_jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const j = data as ImportJob;
  let q = supabase.from("import_errors").select("id,row_number,error_type,message,raw_data").eq("import_job_id", id).order("row_number").limit(200);
  if (type) q = q.eq("error_type", type);
  const { data: errs } = await q;
  const pct = j.total_rows ? Math.round((j.processed_rows / j.total_rows) * 100) : 100;

  return (
    <>
      <Link href="/imports" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" /> Import history</Link>
      <PageHeader title={j.file_name} description={`${IMPORT_STRATEGIES.find((s) => s.value === j.strategy)?.label} · started ${formatDate(j.started_at ?? j.created_at, true)}${j.finished_at ? ` · finished ${formatDate(j.finished_at, true)}` : ""}`}
        actions={<><ImportStatusBadge status={j.status} /><Button variant="outline" asChild><Link href={`/leads?import_job_id=${j.id}`}>View leads</Link></Button><Button variant="outline" asChild><a href={`/api/import/${j.id}/errors`}><Download /> Issues CSV</a></Button></>} />
      {j.status === "processing" ? <Callout tone="warning" className="mb-4" title="Import did not finish">This import stopped while processing (for example the browser tab was closed). Rows up to {formatNumber(j.processed_rows)} were saved. Re-import the file with “Skip duplicates” to continue: already-saved rows are detected and skipped.</Callout> : null}
      {j.error_message ? <Callout tone="danger" className="mb-4" title="Error">{j.error_message}</Callout> : null}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <Progress value={pct} tone={j.status === "completed" ? "emerald" : j.status === "failed" ? "rose" : "brand"} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-7">
            {[["Total rows", j.total_rows], ["Processed", j.processed_rows], ["Saved", j.inserted_count], ["Updated", j.updated_count], ["Duplicates skipped", j.duplicate_count], ["Sent to review", j.review_count], ["Failed", j.failed_count]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{l}</p><p className="text-lg font-semibold tabular-nums">{formatNumber(v as number)}</p></div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div><CardTitle>Row issues</CardTitle><CardDescription>Validation errors, database errors, skipped duplicates and review items (first 200 shown, download for all)</CardDescription></div>
          <div className="flex flex-wrap gap-1 text-xs">
            {[["", "All"], ["validation", "Invalid"], ["database", "Database"], ["skipped_duplicate", "Skipped"], ["duplicate_review", "Review"]].map(([v, l]) => (
              <Link key={v} href={v ? `?type=${v}` : "?"} className={`rounded-full px-3 py-1 ${type === v || (!type && !v) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Row</TH><TH>Type</TH><TH>Reason</TH><TH>Data</TH></TR></THead>
            <TBody>
              {(errs ?? []).length === 0 ? <TR><TD colSpan={4} className="py-10 text-center text-slate-400">No issues</TD></TR> : null}
              {(errs ?? []).map((e) => (
                <TR key={e.id}>
                  <TD className="tabular-nums">{e.row_number}</TD>
                  <TD><Badge tone={TYPE_TONE[e.error_type]}>{e.error_type.replace("_", " ")}</Badge></TD>
                  <TD className="max-w-md text-sm">{e.message}</TD>
                  <TD className="max-w-md truncate text-xs text-slate-500">{Object.values((e.raw_data ?? {}) as Record<string, unknown>).filter(Boolean).slice(0, 5).join(" · ")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
