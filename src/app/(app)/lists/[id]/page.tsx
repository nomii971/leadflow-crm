import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { LeadFilterBar } from "@/components/leads/filter-bar";
import { LeadsTable } from "@/components/leads/leads-table";
import { ListActions } from "@/components/lists/list-dialogs";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { fetchLeadPage } from "@/lib/leads/fetch-page";
import { LEAD_STATUSES } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

export default async function ListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const { supabase } = await requireUserOrRedirect();
  const { data: list } = await supabase.from("lead_lists").select("id,name,description").eq("id", id).maybeSingle();
  if (!list) notFound();
  const [res, lists, statusRows] = await Promise.all([
    fetchLeadPage(supabase, sp, { list_id: id }),
    supabase.from("lead_lists").select("id,name").neq("id", id).order("name"),
    supabase.from("leads").select("status, lead_list_members!inner(list_id)").eq("lead_list_members.list_id", id).limit(10000),
  ]);
  const byStatus = new Map<string, number>();
  for (const r of (statusRows.data ?? []) as { status: string }[]) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  const companies = new Set(res.leads.map((l) => l.company_id).filter(Boolean)).size;

  return (
    <>
      <Link href="/lists" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" /> Lead lists</Link>
      <PageHeader title={list.name} description={list.description ?? undefined} actions={<ListActions list={list} />} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        <div className="rounded-lg border bg-white p-3"><p className="text-xs text-slate-500">Leads</p><p className="text-lg font-semibold tabular-nums">{formatNumber(res.total)}</p></div>
        <div className="rounded-lg border bg-white p-3"><p className="text-xs text-slate-500">Companies (page)</p><p className="text-lg font-semibold tabular-nums">{formatNumber(companies)}</p></div>
        {LEAD_STATUSES.map((s) => (
          <div key={s.value} className="rounded-lg border bg-white p-3"><p className="truncate text-xs text-slate-500">{s.label}</p><p className="text-lg font-semibold tabular-nums">{formatNumber(byStatus.get(s.value) ?? 0)}</p></div>
        ))}
      </div>
      <LeadFilterBar hide={["list_id"]} />
      <LeadsTable {...res} lists={lists.data ?? []} listContext={id} />
    </>
  );
}
