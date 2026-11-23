import Link from "next/link";
import {
  Building, Database, FileUp, Flame, Radar, Sparkles, Target, Trophy, Users, UserPlus, PhoneCall,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { ColumnChart, GrowthChart, HBarChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { CollectionStatusBadge, ImportStatusBadge } from "@/components/shared/status-badges";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

type Row = { label: string; value: number };

export default async function DashboardPage() {
  const { supabase } = await requireUserOrRedirect();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [stats, growth, byCountry, byCity, byIndustry, byStatus, imports, jobs, importSeries, storage] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase.rpc("lead_growth", { p_days: 30 }),
    supabase.rpc("lead_breakdown", { p_dimension: "country", p_limit: 8 }),
    supabase.rpc("lead_breakdown", { p_dimension: "city", p_limit: 8 }),
    supabase.rpc("lead_breakdown", { p_dimension: "industry", p_limit: 8 }),
    supabase.rpc("lead_breakdown", { p_dimension: "status", p_limit: 10 }),
    supabase.from("import_jobs").select("id,file_name,status,inserted_count,total_rows,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("collection_jobs").select("id,name,status,saved_count,retrieved_count,last_heartbeat_at,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("import_jobs").select("created_at,inserted_count,updated_count").gte("created_at", since).order("created_at"),
    supabase.rpc("storage_usage"),
  ]);
  const s = (stats.data ?? {}) as Record<string, number>;
  const num = (rows: unknown) => ((rows ?? []) as { label: string; value: number | string }[]).map((r) => ({ label: r.label, value: Number(r.value) }));
  const statusRows: Row[] = num(byStatus.data).map((r) => ({ ...r, label: statusLabel(r.label) }));

  const perDay = new Map<string, number>();
  for (const r of importSeries.data ?? []) {
    const k = formatDate(r.created_at as string).slice(0, 6);
    perDay.set(k, (perDay.get(k) ?? 0) + Number(r.inserted_count) + Number(r.updated_count));
  }
  const importRows = Array.from(perDay, ([label, value]) => ({ label, value }));

  const empty = !s.total;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live numbers from your lead database."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/imports/new"><FileUp /> Import CSV</Link></Button>
            <Button asChild><Link href="/collector/new"><Radar /> New bulk collection</Link></Button>
          </>
        }
      />

      {empty ? (
        <Card className="mb-6 overflow-hidden border-brand-100 bg-gradient-to-br from-brand-50 to-white">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-900"><Sparkles className="size-4 text-brand-600" /> Your CRM is empty</p>
              <p className="mt-1 text-sm text-slate-600">Import an authorized CSV export, or run a bulk collection from a connected source. All numbers below come from your database.</p>
            </div>
            <Button asChild><Link href="/imports/new">Import your first leads</Link></Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Leads" value={s.total ?? 0} hint={`${formatNumber(s.added_7d ?? 0)} added in 7 days`} icon={<Users />} href="/leads" />
        <StatCard label="New Leads" value={s.new ?? 0} hint="Status: New" icon={<UserPlus />} href="/leads?status=new" />
        <StatCard label="Imported Leads" value={s.imported ?? 0} hint="From imports & collector" icon={<FileUp />} href="/imports" />
        <StatCard label="Contacted" value={s.contacted ?? 0} icon={<PhoneCall />} href="/leads?status=contacted" />
        <StatCard label="Interested" value={s.interested ?? 0} icon={<Flame />} href="/leads?status=interested" />
        <StatCard label="Qualified" value={s.qualified ?? 0} icon={<Target />} href="/leads?status=qualified" />
        <StatCard label="Converted (Won)" value={s.converted ?? 0} icon={<Trophy />} href="/leads?status=won" />
        <StatCard label="Total Companies" value={s.companies ?? 0} icon={<Building />} href="/companies" />
      </div>

      {storage.data ? <StorageCard usage={storage.data as StorageUsage} /> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Lead growth</CardTitle><CardDescription>Total leads in your database, last 30 days</CardDescription></CardHeader>
          <CardContent><GrowthChart data={((growth.data ?? []) as { day: string; added: number; cumulative: number }[]).map((d) => ({ day: d.day, added: Number(d.added), cumulative: Number(d.cumulative) }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lead status distribution</CardTitle><CardDescription>All leads by pipeline stage</CardDescription></CardHeader>
          <CardContent><HBarChart data={statusRows} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Leads by country</CardTitle><CardDescription>Top 8</CardDescription></CardHeader>
          <CardContent><HBarChart data={num(byCountry.data)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Leads by city</CardTitle><CardDescription>Top 8</CardDescription></CardHeader>
          <CardContent><HBarChart data={num(byCity.data)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Leads by industry</CardTitle><CardDescription>Top 8</CardDescription></CardHeader>
          <CardContent><HBarChart data={num(byIndustry.data)} /></CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Import history</CardTitle><CardDescription>Records saved or updated by imports, last 30 days</CardDescription></CardHeader>
          <CardContent><ColumnChart data={importRows} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Recent collection jobs</CardTitle></div><Link href="/collector" className="text-xs font-medium text-brand-600">View all</Link></CardHeader>
          <CardContent className="space-y-2">
            {(jobs.data ?? []).length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No collection jobs yet</p> : null}
            {(jobs.data ?? []).map((j) => (
              <Link key={j.id} href={`/collector/${j.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{j.name}</p><p className="text-xs text-slate-500">{formatNumber(j.saved_count)} saved · {formatDate(j.created_at)}</p></div>
                <CollectionStatusBadge status={j.status} heartbeat={j.last_heartbeat_at} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Recent imports</CardTitle></div><Link href="/imports" className="text-xs font-medium text-brand-600">View all</Link></CardHeader>
          <CardContent className="space-y-2">
            {(imports.data ?? []).length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No imports yet</p> : null}
            {(imports.data ?? []).map((j) => (
              <Link key={j.id} href={`/imports/${j.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{j.file_name}</p><p className="text-xs text-slate-500">{formatNumber(j.inserted_count)} of {formatNumber(j.total_rows)} saved · {formatDate(j.created_at)}</p></div>
                <ImportStatusBadge status={j.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Supabase Free plan: 500 MB database per project.
const DB_LIMIT_BYTES = 500 * 1024 * 1024;
// Measured average on-disk size of one lead row including its indexes (used until there are enough leads to measure).
const DEFAULT_BYTES_PER_LEAD = 2_300;

type StorageUsage = { database_bytes: number; leads_bytes: number; lead_count: number };

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b < 100 * 1024 * 1024 ? 1 : 0)} MB`;

function StorageCard({ usage }: { usage: StorageUsage }) {
  const used = Number(usage.database_bytes);
  const leads = Number(usage.lead_count);
  const pct = Math.min(100, (used / DB_LIMIT_BYTES) * 100);
  const perLead = leads >= 1000 ? Math.max(500, Number(usage.leads_bytes) / leads) : DEFAULT_BYTES_PER_LEAD;
  const roomFor = Math.max(0, Math.floor((DB_LIMIT_BYTES - used) / perLead));
  const tone = pct >= 90 ? "rose" : pct >= 70 ? "amber" : "brand";
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 sm:w-64">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Database className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Database storage</p>
            <p className="text-xs text-slate-500">Supabase free plan: 500 MB</p>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span><b className="tabular-nums">{mb(used)}</b> <span className="text-slate-500">of 500 MB used ({pct.toFixed(pct < 10 ? 1 : 0)}%)</span></span>
            <span className="text-xs text-slate-500">room for about {formatNumber(roomFor)} more leads</span>
          </div>
          <Progress value={pct} tone={tone} />
          {pct >= 70 ? (
            <p className="text-xs text-amber-700">Getting full. Use <Link className="font-medium underline" href="/export">Export &amp; delete</Link> to download leads you are done with and free space.</p>
          ) : (
            <p className="text-xs text-slate-500">Includes Supabase&apos;s own system tables. To free space, use <Link className="font-medium text-brand-600 hover:underline" href="/export">Export &amp; delete</Link>.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
