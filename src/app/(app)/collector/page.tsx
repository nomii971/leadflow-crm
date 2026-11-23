import Link from "next/link";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Callout, EmptyState, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CollectionStatusBadge } from "@/components/shared/status-badges";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { adapterCatalog } from "@/lib/collector/registry";
import { describeConfig } from "@/lib/collector/filters";
import type { CollectionJob } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Bulk Lead Collector" };
const TONE: Record<string, string> = { connected: "emerald", available: "emerald", not_configured: "amber", unavailable: "slate", error: "rose" };

export default async function CollectorPage() {
  const { supabase } = await requireUserOrRedirect();
  const [{ data }, adapters] = await Promise.all([
    supabase.from("collection_jobs").select("*").order("created_at", { ascending: false }).limit(100),
    adapterCatalog(),
  ]);
  const jobs = (data ?? []) as CollectionJob[];
  return (
    <>
      <PageHeader
        icon={<Radar />}
        title="Bulk Lead Collector"
        description="Choose locations and filters, then process every record the authorized source makes available, page after page, until it reports no more results, your limit is hit, the source restricts access, or you stop the job."
        actions={<Button size="lg" asChild><Link href="/collector/new"><Radar /> New bulk collection</Link></Button>}
      />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {adapters.map((a) => (
          <Card key={a.id}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{a.name}</p><Badge tone={TONE[a.status.state]} dot>{a.status.label}</Badge></div>
              <p className="mt-1 text-xs text-slate-500">{a.status.detail}</p>
              <p className="mt-2 text-xs text-slate-400">
                {a.capabilities.pagination ? "Paginated" : "No pagination"} · {a.capabilities.totalCount ? "Reports totals" : "No totals"} · {a.capabilities.pauseResume ? "Pause/resume" : "No resume"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Callout tone="info" className="mb-6" title="About LinkedIn Sales Navigator">
        This CRM does not scrape LinkedIn, read your LinkedIn cookies or call private LinkedIn endpoints, so it cannot pull Sales Navigator search results directly. Use LinkedIn&apos;s official CRM Sync into HubSpot (then the HubSpot source here), or process an authorized export file. See <Link className="font-semibold underline" href="/integrations">Integrations</Link>.
      </Callout>
      {jobs.length === 0 ? (
        <EmptyState icon={<Radar />} title="No collection jobs yet" description="Create your first bulk job, e.g. United Arab Emirates · Dubai, Abu Dhabi, Sharjah · Real Estate." action={<Button asChild><Link href="/collector/new">Create a job</Link></Button>} />
      ) : (
        <div className="rounded-xl border bg-white shadow-xs">
          <Table>
            <THead><TR><TH>Job</TH><TH>Status</TH><TH>Progress</TH><TH className="text-right">Retrieved</TH><TH className="text-right">Saved</TH><TH className="text-right">Duplicates</TH><TH className="text-right">Failed</TH><TH>Created</TH></TR></THead>
            <TBody>
              {jobs.map((j) => {
                const target = j.total_reported !== null ? Math.min(j.total_reported, j.max_records) : j.max_records;
                return (
                  <TR key={j.id}>
                    <TD className="max-w-80">
                      <Link href={`/collector/${j.id}`} className="font-medium hover:text-brand-600 hover:underline">{j.name}</Link>
                      <p className="truncate text-xs text-slate-500">{describeConfig({ locations: j.config.locations ?? [], filters: j.config.filters ?? {} })}</p>
                    </TD>
                    <TD><CollectionStatusBadge status={j.status} heartbeat={j.last_heartbeat_at} /></TD>
                    <TD className="w-40"><Progress value={target ? (j.retrieved_count / target) * 100 : 0} /></TD>
                    <TD className="text-right tabular-nums">{formatNumber(j.retrieved_count)}{j.total_reported !== null ? <span className="text-slate-400"> / {formatNumber(j.total_reported)}</span> : null}</TD>
                    <TD className="text-right tabular-nums text-emerald-700">{formatNumber(j.saved_count)}</TD>
                    <TD className="text-right tabular-nums">{formatNumber(j.duplicate_count)}</TD>
                    <TD className="text-right tabular-nums text-rose-700">{formatNumber(j.failed_count)}</TD>
                    <TD className="whitespace-nowrap text-xs text-slate-500">{formatDate(j.created_at, true)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </>
  );
}
