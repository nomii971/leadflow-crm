import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building, ExternalLink, Globe, Mail, MapPin, Phone, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadStatusBadge, PriorityBadge, VerifiedBadge } from "@/components/shared/status-badges";
import { ActivityPanel, AddToListButton, EditLeadButton, StatusSwitcher, TasksPanel } from "@/components/leads/lead-panels";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { ORIGINS } from "@/lib/constants";
import type { Activity, Lead, Task } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUserOrRedirect();
  const [{ data: lead }, activities, notes, tasks, lists, memberships] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("activities").select("*").eq("lead_id", id).order("occurred_at", { ascending: false }).limit(100),
    supabase.from("notes").select("id,content,created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("tasks").select("*").eq("lead_id", id).order("completed").order("due_at", { nullsFirst: false }),
    supabase.from("lead_lists").select("id,name").order("name"),
    supabase.from("lead_list_members").select("list_id, lead_lists(name)").eq("lead_id", id),
  ]);
  if (!lead) notFound();
  const l = lead as Lead;
  const memberOf = (memberships.data ?? []) as unknown as { list_id: string; lead_lists: { name: string } | null }[];

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 break-words text-slate-900">{value || <span className="text-slate-300">—</span>}</dd>
    </div>
  );

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" /> All leads</Link>
      <div className="mb-6 flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-lg font-semibold text-white">
            {l.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{l.full_name}</h1>
            <p className="text-sm text-slate-600">{[l.job_title, l.company_name].filter(Boolean).join(" at ") || "—"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5"><LeadStatusBadge status={l.status} /><PriorityBadge priority={l.priority} /><VerifiedBadge verified={l.is_verified} /></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSwitcher lead={l} />
          <AddToListButton leadId={l.id} lists={lists.data ?? []} />
          <EditLeadButton lead={l} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><Mail className="size-4 text-slate-400" />{l.business_email ? <a className="text-brand-600 hover:underline" href={`mailto:${l.business_email}`}>{l.business_email}</a> : "—"}{l.business_email ? (l.email_verified ? <Badge tone="emerald">verified</Badge> : <Badge>unverified</Badge>) : null}</p>
              <p className="flex items-center gap-2"><Phone className="size-4 text-slate-400" />{l.business_phone ?? "—"}{l.business_phone ? (l.phone_verified ? <Badge tone="emerald">verified</Badge> : <Badge>unverified</Badge>) : null}</p>
              {l.personal_email ? <p className="flex items-center gap-2"><Mail className="size-4 text-slate-400" /><a className="text-brand-600 hover:underline" href={`mailto:${l.personal_email}`}>{l.personal_email}</a><Badge>personal</Badge></p> : null}
              {l.mobile_phone ? <p className="flex items-center gap-2"><Smartphone className="size-4 text-slate-400" /><a className="hover:underline" href={`tel:${l.mobile_phone.replace(/[^+\d]/g, "")}`}>{l.mobile_phone}</a><Badge>mobile</Badge></p> : null}
              {l.company_email ? <p className="flex items-center gap-2"><Mail className="size-4 text-slate-400" /><a className="text-brand-600 hover:underline" href={`mailto:${l.company_email}`}>{l.company_email}</a><Badge>company</Badge></p> : null}
              {l.company_phone ? <p className="flex items-center gap-2"><Phone className="size-4 text-slate-400" />{l.company_phone}<Badge>company</Badge></p> : null}
              <p className="flex items-center gap-2"><ExternalLink className="size-4 text-slate-400" />{l.linkedin_url ? <a className="text-brand-600 hover:underline" href={l.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn profile</a> : "—"}</p>
              <p className="flex items-center gap-2"><Globe className="size-4 text-slate-400" />{l.company_website ? <a className="text-brand-600 hover:underline" href={l.company_website} target="_blank" rel="noopener noreferrer">{l.company_website.replace(/^https?:\/\//, "")}</a> : "—"}</p>
              <p className="flex items-center gap-2"><MapPin className="size-4 text-slate-400" />{[l.city, l.state, l.country].filter(Boolean).join(", ") || "—"}</p>
              <p className="flex items-center gap-2"><Building className="size-4 text-slate-400" />{l.company_id ? <Link className="text-brand-600 hover:underline" href={`/leads?company_id=${l.company_id}`}>{l.company_name}</Link> : l.company_name ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="divide-y divide-slate-100">
                {row("Industry", l.industry)}
                {row("Company size", l.company_size)}
                {row("Seniority", l.seniority)}
                {row("Department", l.department)}
                {row("Region", l.region)}
                {row("Lead source", l.lead_source)}
                {row("Source reference", l.source_reference && /^https?:\/\//.test(l.source_reference) ? <a className="text-brand-600 hover:underline" href={l.source_reference} target="_blank" rel="noopener noreferrer">Open source</a> : l.source_reference)}
                {row("Origin", ORIGINS.find((o) => o.value === l.origin)?.label)}
                {row("Collected", formatDate(l.collected_at, true))}
                {row("Date added", formatDate(l.created_at, true))}
                {row("Last contacted", formatDate(l.last_contacted_at, true))}
                {row("Verified at", l.verified_at ? formatDate(l.verified_at, true) : null)}
                {row("Import job", l.import_job_id ? <Link className="text-brand-600 hover:underline" href={`/imports/${l.import_job_id}`}>View import</Link> : null)}
                {row("Collection job", l.collection_job_id ? <Link className="text-brand-600 hover:underline" href={`/collector/${l.collection_job_id}`}>View job</Link> : null)}
                {row("Lists", memberOf.length ? memberOf.map((m) => <Link key={m.list_id} href={`/lists/${m.list_id}`} className="mr-1"><Badge tone="indigo">{m.lead_lists?.name}</Badge></Link>) : null)}
              </dl>
              {l.notes ? <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">{l.notes}</div> : null}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <TasksPanel leadId={l.id} tasks={(tasks.data ?? []) as Task[]} />
          <ActivityPanel leadId={l.id} activities={(activities.data ?? []) as Activity[]} notes={notes.data ?? []} />
        </div>
      </div>
    </>
  );
}
