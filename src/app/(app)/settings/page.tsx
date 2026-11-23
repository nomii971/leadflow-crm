import { Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, PageHeader } from "@/components/ui/misc";
import { DangerZone, PasswordForm, SettingsForm } from "@/components/shared/settings-forms";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { adminEmail } from "@/lib/env";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUserOrRedirect();
  const [{ data: s }, leads, results, errors] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("collection_job_results").select("id", { count: "exact", head: true }),
    supabase.from("import_errors").select("id", { count: "exact", head: true }),
  ]);
  const rows = (leads.count ?? 0) + (results.count ?? 0) + (errors.count ?? 0);
  const estMb = Math.round((rows * 2.5) / 1024); // rough: ~2.5 KB per row incl. indexes
  return (
    <>
      <PageHeader icon={<Settings />} title="Settings" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card><CardHeader><CardTitle>Preferences</CardTitle></CardHeader><CardContent>
            <SettingsForm s={{ display_name: s?.display_name ?? null, default_page_size: s?.default_page_size ?? 50, default_import_strategy: s?.default_import_strategy ?? "skip_duplicates", default_lead_source: s?.default_lead_source ?? "LinkedIn Sales Navigator", timezone: s?.timezone ?? "UTC" }} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Account & security</CardTitle><CardDescription>Signed in as {user.email}</CardDescription></CardHeader><CardContent className="space-y-4">
            {adminEmail() ? <Callout tone="success">Single-user lock is on: only {adminEmail()} can use this app.</Callout> : <Callout tone="warning" title="Single-user lock is off">Set <code>ADMIN_EMAIL</code> in your environment and disable sign-ups in Supabase so nobody else can create an account.</Callout>}
            <PasswordForm />
          </CardContent></Card>
          <Card className="border-rose-200"><CardHeader><CardTitle className="text-rose-700">Danger zone</CardTitle></CardHeader><CardContent><DangerZone /></CardContent></Card>
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle>Free tier usage</CardTitle><CardDescription>Approximate, from row counts</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p><b>{formatNumber(leads.count ?? 0)}</b> leads · <b>{formatNumber((results.count ?? 0) + (errors.count ?? 0))}</b> log rows</p>
            <p>Estimated database size: <b>~{estMb} MB</b> of the 500 MB Supabase free limit.</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-500">
              <li>Supabase Free: 500 MB database, 50k monthly active users, projects pause after 7 days of inactivity (resume from the dashboard).</li>
              <li>Vercel Hobby: personal, non-commercial use; functions up to 60 s, which is why imports and collection run page by page.</li>
              <li>HubSpot free CRM API: rate limits apply (search ~5 requests/second); the collector retries 429 responses automatically.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
