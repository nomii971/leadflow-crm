import Link from "next/link";
import { Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, PageHeader } from "@/components/ui/misc";
import { adapterCatalog } from "@/lib/collector/registry";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { HubspotConnect } from "@/components/integrations/hubspot-connect";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";
const TONE: Record<string, string> = { connected: "emerald", available: "emerald", not_configured: "amber", unavailable: "slate", error: "rose" };

export default async function IntegrationsPage() {
  const { supabase } = await requireUserOrRedirect();
  const [adapters, hs] = await Promise.all([adapterCatalog(), supabase.rpc("integration_secret_status", { p_provider: "hubspot" })]);
  const hsStatus = (hs.data ?? { configured: false }) as { configured: boolean; last4?: string; updated_at?: string };
  const hubspotFromEnv = !!process.env.HUBSPOT_ACCESS_TOKEN?.trim();
  return (
    <>
      <PageHeader icon={<Plug />} title="Integrations" description="Authorized data sources and their live connection status. Status is checked on the server each time this page loads." />
      <div className="grid gap-4 lg:grid-cols-3">
        {adapters.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2"><CardTitle>{a.name}</CardTitle><Badge tone={TONE[a.status.state]} dot>{a.status.label}</Badge></div>
              <CardDescription>{a.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-slate-600">{a.status.detail}</p>
              {a.id === "hubspot" ? (
                <div className="border-t border-slate-100 pt-3">
                  <HubspotConnect fromEnv={hubspotFromEnv} saved={hsStatus.configured ? { last4: hsStatus.last4 ?? "", updated_at: hsStatus.updated_at } : null} />
                </div>
              ) : null}
              <ul className="space-y-1 text-xs text-slate-500">
                <li>Pagination: {a.capabilities.pagination ? "yes" : "no"}</li>
                <li>Reports total results: {a.capabilities.totalCount ? "yes" : "no"}</li>
                <li>Pause / resume: {a.capabilities.pauseResume ? "yes" : "no"}</li>
                <li>Max page size: {a.capabilities.maxPageSize || "—"}</li>
                {a.capabilities.maxResultsPerSearch ? <li>Max results per search: {a.capabilities.maxResultsPerSearch.toLocaleString()}</li> : null}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>LinkedIn Sales Navigator: what works and what doesn&apos;t</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p><b>Not possible in this app:</b> pulling Sales Navigator search results automatically. LinkedIn offers no public API for that; programmatic access is limited to approved partners (Sales Navigator Application Platform). This CRM does not scrape pages, use browser automation on LinkedIn, read session cookies or call undocumented endpoints.</p>
          <p><b>Authorized routes that work today:</b></p>
          <ol className="list-decimal space-y-1 pl-5">
            <li><b>CRM Sync → HubSpot → LeadFlow.</b> Sales Navigator Advanced Plus can sync leads to HubSpot (free CRM). Add a HubSpot private app token and use the HubSpot source in the Bulk Lead Collector. Real pagination, totals and completion signals.</li>
            <li><b>Authorized export files.</b> Exports from your CRM or a data provider you are licensed to use. Import them in <Link className="text-brand-600 underline" href="/imports/new">Bulk CSV import</Link>, or process them with location/title filters in the <Link className="text-brand-600 underline" href="/collector/new">Bulk Lead Collector</Link>.</li>
            <li><b>Lead URLs and references.</b> Keep each lead&apos;s Sales Navigator or LinkedIn profile URL in the LinkedIn Profile URL / Source Reference fields; they are used for duplicate detection.</li>
          </ol>
          <Callout tone="info" title="Adding a future source">Each source is an adapter (<code>src/lib/collector/adapters</code>) implementing one interface: <code>status()</code> and <code>fetchPage(config, cursor)</code>. Register it in <code>registry.ts</code> and it appears here and in the collector, with the same progress, retry, duplicate and reporting features. No CRM rebuild needed.</Callout>
        </CardContent>
      </Card>

      <Card className="mt-6" id="hubspot-setup">
        <CardHeader>
          <CardTitle>Connecting HubSpot (free), step by step</CardTitle>
          <CardDescription>About 5 minutes. No code and no hosting settings needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Create a free account at <a className="text-brand-600 underline" href="https://www.hubspot.com/products/crm" target="_blank" rel="noopener noreferrer">hubspot.com</a> (Free CRM), or sign in.</li>
            <li>In HubSpot, open <b>Settings</b> (gear icon) → <b>Integrations</b> → <b>Private Apps</b>. In newer accounts this is under <b>Development</b> → <b>Legacy apps</b> → <b>Create a legacy app</b> → <b>Private</b>.</li>
            <li>Name it <b>LeadFlow CRM</b>. On the <b>Scopes</b> tab tick <code>crm.objects.contacts.read</code> (required). <code>crm.objects.companies.read</code> is optional. Do not tick any write scopes.</li>
            <li>Click <b>Create app</b>, then <b>Show token</b> → <b>Copy</b>. It starts with <code>pat-</code>.</li>
            <li>Paste it in the HubSpot card above and click <b>Connect HubSpot</b>. The card turns <b>Connected</b>.</li>
            <li>Go to <Link className="text-brand-600 underline" href="/collector/new">Bulk Lead Collector</Link>, choose <b>HubSpot CRM (free)</b>, pick locations and filters, and start. Contacts are saved as leads with their emails and phone numbers.</li>
          </ol>
          <Callout tone="info" title="Where the emails and phone numbers come from">HubSpot sends only the contacts, emails and phone numbers that are already in your HubSpot account. It does not look up new ones. Contacts get into HubSpot from Sales Navigator <b>CRM Sync</b> (needs a Sales Navigator plan with CRM Sync, such as Advanced Plus), from your own imports into HubSpot, or from forms and email. LeadFlow then pulls them in with their email and phone fields.</Callout>
        </CardContent>
      </Card>
    </>
  );
}
