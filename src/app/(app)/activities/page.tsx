import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { ACTIVITY_TYPES } from "@/lib/constants";
import type { Activity } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Activities" };
const TONE: Record<string, string> = { call: "blue", email: "violet", linkedin_message: "cyan", meeting: "amber", note: "slate", status_change: "slate", other: "slate" };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUserOrRedirect();
  const page = Math.max(1, Number(sp.page) || 1);
  const per = 50;
  let q = supabase.from("activities").select("*, leads(full_name, company_name)", { count: "exact" }).order("occurred_at", { ascending: false }).range((page - 1) * per, page * per - 1);
  if (sp.type) q = q.eq("type", sp.type);
  const { data, count } = await q;
  const rows = (data ?? []) as Activity[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / per));
  return (
    <>
      <PageHeader icon={<ActivityIcon />} title="Activities" description="Calls, emails, LinkedIn messages, meetings and status changes across all leads. Log new activity from a lead's profile." />
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <Link href="?" className={`rounded-full px-3 py-1 ${!sp.type ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>All</Link>
        {ACTIVITY_TYPES.map((t) => <Link key={t.value} href={`?type=${t.value}`} className={`rounded-full px-3 py-1 ${sp.type === t.value ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>{t.label}</Link>)}
      </div>
      <div className="rounded-xl border bg-white shadow-xs">
        <Table>
          <THead><TR><TH>When</TH><TH>Type</TH><TH>Lead</TH><TH>Subject</TH><TH>Outcome</TH></TR></THead>
          <TBody>
            {rows.length === 0 ? <TR><TD colSpan={5} className="py-12 text-center text-slate-400">No activities yet</TD></TR> : null}
            {rows.map((a) => (
              <TR key={a.id}>
                <TD className="whitespace-nowrap text-xs text-slate-500">{formatDate(a.occurred_at, true)}</TD>
                <TD><Badge tone={TONE[a.type]}>{ACTIVITY_TYPES.find((t) => t.value === a.type)?.label}</Badge></TD>
                <TD>{a.lead_id && a.leads ? <Link className="font-medium hover:text-brand-600 hover:underline" href={`/leads/${a.lead_id}`}>{a.leads.full_name}</Link> : "—"}<span className="block text-xs text-slate-500">{a.leads?.company_name}</span></TD>
                <TD className="max-w-md"><p className="truncate">{a.subject ?? "—"}</p>{a.body ? <p className="truncate text-xs text-slate-500">{a.body}</p> : null}</TD>
                <TD className="text-sm text-slate-600">{a.outcome ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-slate-600">
          <span>{formatNumber(count ?? 0)} activities</span>
          <span className="flex gap-3">
            {page > 1 ? <Link href={`?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), page: String(page - 1) })}`} className="text-brand-600">Previous</Link> : null}
            Page {page} of {pages}
            {page < pages ? <Link href={`?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), page: String(page + 1) })}`} className="text-brand-600">Next</Link> : null}
          </span>
        </div>
      </div>
    </>
  );
}
