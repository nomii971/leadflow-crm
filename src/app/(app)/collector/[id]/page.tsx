import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { JobRunner } from "@/components/collector/job-runner";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { getAdapter } from "@/lib/collector/registry";
import { describeConfig } from "@/lib/collector/filters";
import { COLLECTOR_DUPLICATE_STRATEGIES } from "@/lib/constants";
import type { CollectionJob } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const OUTCOME_TONE: Record<string, string> = { saved: "emerald", updated: "blue", duplicate: "slate", review: "amber", failed: "rose" };

export default async function CollectionJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUserOrRedirect();
  const [{ data }, results] = await Promise.all([
    supabase.from("collection_jobs").select("*").eq("id", id).maybeSingle(),
    supabase.from("collection_job_results").select("id,page_number,outcome,lead_id,source_record_id,error_message,raw_data,created_at").eq("job_id", id).order("created_at", { ascending: false }).limit(25),
  ]);
  if (!data) notFound();
  const job = data as CollectionJob;
  const adapter = getAdapter(job.source_adapter);

  return (
    <>
      <Link href="/collector" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" /> Bulk Lead Collector</Link>
      <PageHeader title={job.name} description={`${adapter?.name ?? job.source_adapter} · ${describeConfig({ locations: job.config.locations ?? [], filters: job.config.filters ?? {} })}`} />
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Badge>Max {job.max_records.toLocaleString()} records</Badge>
        <Badge>Page size {job.page_size}</Badge>
        <Badge>{COLLECTOR_DUPLICATE_STRATEGIES.find((s) => s.value === job.duplicate_strategy)?.label}</Badge>
        <Badge>Created {formatDate(job.created_at, true)}</Badge>
      </div>
      <JobRunner initial={job} />
      <Card className="mt-4">
        <CardHeader><CardTitle>Latest record outcomes</CardTitle><p className="text-xs text-slate-500">Last 25 records. Download the full record log above for everything.</p></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Page</TH><TH>Outcome</TH><TH>Record</TH><TH>Detail</TH></TR></THead>
            <TBody>
              {(results.data ?? []).length === 0 ? <TR><TD colSpan={4} className="py-8 text-center text-slate-400">No records processed yet</TD></TR> : null}
              {(results.data ?? []).map((r) => {
                const raw = (r.raw_data ?? {}) as Record<string, string>;
                return (
                  <TR key={r.id}>
                    <TD className="tabular-nums">{r.page_number}</TD>
                    <TD><Badge tone={OUTCOME_TONE[r.outcome]}>{r.outcome}</Badge></TD>
                    <TD className="max-w-72 truncate">{r.lead_id ? <Link className="hover:text-brand-600 hover:underline" href={`/leads/${r.lead_id}`}>{raw.full_name ?? r.source_record_id}</Link> : raw.full_name ?? r.source_record_id ?? "—"}</TD>
                    <TD className="max-w-md truncate text-xs text-slate-500">{r.error_message ?? [raw.job_title, raw.company_name, raw.city].filter(Boolean).join(" · ")}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
