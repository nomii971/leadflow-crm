import Link from "next/link";
import { ClockArrowLeft, FileUp, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ImportStatusBadge } from "@/components/shared/status-badges";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { IMPORT_STRATEGIES } from "@/lib/constants";
import type { ImportJob } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Import History" };

export default async function ImportsPage() {
  const { supabase } = await requireUserOrRedirect();
  const [{ data }, reviews] = await Promise.all([
    supabase.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("duplicate_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const jobs = (data ?? []) as ImportJob[];
  return (
    <>
      <PageHeader
        icon={<ClockArrowLeft />}
        title="Import History"
        description="Every import with its final report, failed rows and duplicates."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/imports/duplicates"><GitMerge /> Duplicate review {reviews.count ? `(${reviews.count})` : ""}</Link></Button>
            <Button asChild><Link href="/imports/new"><FileUp /> New import</Link></Button>
          </>
        }
      />
      {jobs.length === 0 ? (
        <EmptyState icon={<FileUp />} title="No imports yet" description="Import a CSV or Excel export of authorized lead data." action={<Button asChild><Link href="/imports/new">Start an import</Link></Button>} />
      ) : (
        <div className="rounded-xl border bg-white shadow-xs">
          <Table>
            <THead><TR><TH>File</TH><TH>Status</TH><TH>Strategy</TH><TH className="text-right">Rows</TH><TH className="text-right">Saved</TH><TH className="text-right">Updated</TH><TH className="text-right">Duplicates</TH><TH className="text-right">Review</TH><TH className="text-right">Failed</TH><TH>Date</TH></TR></THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={j.id}>
                  <TD className="max-w-64 truncate font-medium"><Link className="hover:text-brand-600 hover:underline" href={`/imports/${j.id}`}>{j.file_name}</Link></TD>
                  <TD><ImportStatusBadge status={j.status} /></TD>
                  <TD className="text-xs text-slate-600">{IMPORT_STRATEGIES.find((s) => s.value === j.strategy)?.label}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(j.processed_rows)}{j.total_rows && j.total_rows !== j.processed_rows ? <span className="text-slate-400"> / {formatNumber(j.total_rows)}</span> : null}</TD>
                  <TD className="text-right tabular-nums text-emerald-700">{formatNumber(j.inserted_count)}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(j.updated_count)}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(j.duplicate_count)}</TD>
                  <TD className="text-right tabular-nums text-amber-700">{formatNumber(j.review_count)}</TD>
                  <TD className="text-right tabular-nums text-rose-700">{formatNumber(j.failed_count)}</TD>
                  <TD className="whitespace-nowrap text-xs text-slate-500">{formatDate(j.created_at, true)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </>
  );
}
